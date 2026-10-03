package expo.modules.signifycamera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Matrix
import android.net.Uri
import android.os.SystemClock
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.nio.FloatBuffer
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.min

class SignifyCameraView(context: Context, private val nativeContext: AppContext) : ExpoView(context, nativeContext), DefaultLifecycleObserver {
  private val onPrediction by EventDispatcher()
  private val onStatus by EventDispatcher()
  private val executor = Executors.newSingleThreadExecutor()
  private val previewView = PreviewView(context).also {
    it.implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    it.scaleType = PreviewView.ScaleType.FILL_CENTER
    addView(it, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }
  @Volatile private var active = false
  private var modelPath = ""
  private var handPath = ""
  private var loadedPath = ""
  private var provider: ProcessCameraProvider? = null
  private var preview: Preview? = null
  private var analysis: ImageAnalysis? = null
  private var owner: LifecycleOwner? = null
  private var session: OrtSession? = null
  private var handDetector: HandLandmarker? = null
  private val environment = OrtEnvironment.getEnvironment()
  private var lastFrame = 0L
  private var disposed = false

  fun setModelPath(path: String) { modelPath = path; prepare() }
  fun setHandModelPath(path: String) { handPath = path; prepare() }
  fun setActive(value: Boolean) { active = value; if (value) prepare() else stop() }
  override fun onStop(owner: LifecycleOwner) { active = false; stop() }
  override fun onDetachedFromWindow() {
    active = false; stop(); owner?.lifecycle?.removeObserver(this)
    disposed = true
    executor.execute { session?.close(); session = null; handDetector?.close(); handDetector = null }
    executor.shutdown()
    super.onDetachedFromWindow()
  }
  private fun path(uri: String) = if (uri.startsWith("file:")) Uri.parse(uri).path!! else uri
  private fun prepare() {
    if (!active || modelPath.isEmpty() || handPath.isEmpty() || disposed) return
    val model = modelPath; val hands = handPath
    executor.execute {
      try {
        if (loadedPath != model) {
          status("loading")
          session?.close(); handDetector?.close()
          OrtSession.SessionOptions().use { options ->
            options.setIntraOpNumThreads(1)
            session = environment.createSession(path(model), options)
          }
          val base = BaseOptions.builder().setModelAssetPath(path(hands)).build()
          handDetector = HandLandmarker.createFromOptions(context,
            HandLandmarker.HandLandmarkerOptions.builder().setBaseOptions(base)
              .setRunningMode(RunningMode.VIDEO).setNumHands(1)
              .setMinHandDetectionConfidence(0.65f).setMinHandPresenceConfidence(0.65f)
              .setMinTrackingConfidence(0.65f).build())
          loadedPath = model
        }
        post { if (active && !disposed) start() }
      } catch (_: Exception) { fail("The recognition model could not load. You can still type a message.") }
    }
  }
  private fun start() {
    if (analysis != null || !active) return
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      fail("Allow camera access in Settings to recognize letters."); return
    }
    val lifecycleOwner = nativeContext.currentActivity as? LifecycleOwner ?: run {
      fail("The camera is unavailable. Reopen the app and try again."); return
    }
    owner = lifecycleOwner; lifecycleOwner.lifecycle.addObserver(this)
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      if (!active || disposed || analysis != null) return@addListener
      try {
        val cameras = future.get(); provider = cameras
        if (!cameras.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)) {
          fail("No front camera is available. You can still type a message."); return@addListener
        }
        val cameraPreview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
        val cameraAnalysis = ImageAnalysis.Builder()
          .setTargetResolution(android.util.Size(640, 480))
          .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
          .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888).build()
        cameraAnalysis.setAnalyzer(executor) { image -> analyze(image) }
        cameras.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_FRONT_CAMERA, cameraPreview, cameraAnalysis)
        preview = cameraPreview; analysis = cameraAnalysis
        status("live")
      } catch (_: Exception) { fail("Your camera is unavailable. Close other camera apps and try again.") }
    }, ContextCompat.getMainExecutor(context))
  }
  private fun analyze(image: ImageProxy) {
    val started = SystemClock.uptimeMillis()
    try {
      if (!active || started - lastFrame < 83) return
      lastFrame = started
      val model = session ?: return
      val detector = handDetector ?: return
      val raw = image.toBitmap()
      val bitmap = if (image.imageInfo.rotationDegrees == 0) raw else Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height,
        Matrix().apply { postRotate(image.imageInfo.rotationDegrees.toFloat()) }, true)
      try {
        val mpImage = BitmapImageBuilder(bitmap).build()
        val result = try { detector.detectForVideo(mpImage, started) } finally { mpImage.close() }
        val hand = result.landmarks().firstOrNull()
        if (hand == null) { prediction(emptyList(), false, started); return }
        val minX = hand.minOf { it.x() } * bitmap.width; val maxX = hand.maxOf { it.x() } * bitmap.width
        val minY = hand.minOf { it.y() } * bitmap.height; val maxY = hand.maxOf { it.y() } * bitmap.height
        val margin = max(24f, (maxX - minX) * 0.22f)
        val left = max(0, (minX - margin).toInt()); val top = max(0, (minY - margin).toInt())
        val right = min(bitmap.width, (maxX + margin).toInt()); val bottom = min(bitmap.height, (maxY + margin).toInt())
        if (right - left < 12 || bottom - top < 12) { prediction(emptyList(), false, started); return }
        val cropped = Bitmap.createBitmap(bitmap, left, top, right - left, bottom - top)
        val tile = Bitmap.createScaledBitmap(cropped, 28, 28, true)
        val colors = IntArray(784); tile.getPixels(colors, 0, 28, 0, 0, 28, 28)
        val pixels = FloatArray(784) { i ->
          val color = colors[i]
          ((0.299f * Color.red(color) + 0.587f * Color.green(color) + 0.114f * Color.blue(color)) / 255f - 0.485f) / 0.229f
        }
        if (tile !== cropped) tile.recycle()
        if (cropped !== bitmap) cropped.recycle()
        OnnxTensor.createTensor(environment, FloatBuffer.wrap(pixels), longArrayOf(1,1,28,28)).use { input ->
          model.run(mapOf(model.inputNames.first() to input)).use { outputs ->
            val tensor = outputs[0] as OnnxTensor
            val buffer = tensor.floatBuffer
            val logits = FloatArray(buffer.remaining()); buffer.get(logits)
            prediction(logits.map { it.toDouble() }, true, started, hand.map { mapOf("x" to it.x().toDouble(), "y" to it.y().toDouble(), "z" to it.z().toDouble()) }, bitmap.width, bitmap.height)
          }
        }
      } finally { if (bitmap !== raw) bitmap.recycle(); raw.recycle() }
    } catch (_: Exception) { fail("Recognition paused. Your message is safe. Try the camera again.") }
    finally { image.close() }
  }
  private fun stop() {
    post {
      analysis?.clearAnalyzer()
      val useCases = listOfNotNull(preview, analysis).toTypedArray()
      if (useCases.isNotEmpty()) provider?.unbind(*useCases)
      analysis = null; preview = null
    }
  }
  private fun status(state: String, message: String = "") { post { onStatus(mapOf("state" to state, "message" to message)) } }
  private fun prediction(logits: List<Double>, hasHand: Boolean, started: Long, landmarks: List<Map<String, Double>> = emptyList(), width: Int = 0, height: Int = 0) {
    val duration = SystemClock.uptimeMillis() - started
    post { if (active) onPrediction(mapOf("logits" to logits, "hasHand" to hasHand, "latencyMs" to duration, "landmarks" to landmarks, "width" to width, "height" to height)) }
  }
  private fun fail(message: String) { active = false; stop(); status("error", message) }
}
