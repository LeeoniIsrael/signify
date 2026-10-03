import AVFoundation
import CoreImage
import ExpoModulesCore
import Vision
import onnxruntime_objc

final class SignifyCameraView: ExpoView, AVCaptureVideoDataOutputSampleBufferDelegate {
  let onPrediction = EventDispatcher()
  let onStatus = EventDispatcher()
  private let capture = AVCaptureSession()
  private let queue = DispatchQueue(label: "signify.camera.inference", qos: .userInitiated)
  private let imageContext = CIContext(options: [.cacheIntermediates: false])
  private lazy var preview = AVCaptureVideoPreviewLayer(session: capture)
  private var environment: ORTEnv?
  private var model: ORTSession?
  private var inputName = "input"
  private var outputNames: Set<String> = []
  private var configured = false
  private var requestedActive = false
  private var loadedPath = ""
  private var lastFrameTime: Double = 0
  private let handRequest = VNDetectHumanHandPoseRequest()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    preview.videoGravity = .resizeAspectFill
    layer.addSublayer(preview)
    handRequest.maximumHandCount = 1
    NotificationCenter.default.addObserver(self, selector: #selector(suspend), name: UIApplication.willResignActiveNotification, object: nil)
  }
  override func layoutSubviews() { super.layoutSubviews(); preview.frame = bounds }
  override func didMoveToWindow() { super.didMoveToWindow(); if window == nil { setActive(false) } }
  deinit { NotificationCenter.default.removeObserver(self); if capture.isRunning { capture.stopRunning() } }
  @objc private func suspend() { setActive(false) }

  func setActive(_ active: Bool) {
    queue.async { [weak self] in
      guard let self else { return }
      self.requestedActive = active
      if active { self.startIfReady() } else if self.capture.isRunning { self.capture.stopRunning() }
    }
  }
  func loadModel(_ uri: String) {
    guard !uri.isEmpty else { return }
    queue.async { [weak self] in
      guard let self, uri != self.loadedPath else { return }
      do {
        self.emitStatus("loading")
        let path = URL(string: uri)?.isFileURL == true ? URL(string: uri)!.path : uri
        let env = try ORTEnv(loggingLevel: .warning)
        let options = try ORTSessionOptions()
        try options.setIntraOpNumThreads(1)
        let session = try ORTSession(env: env, modelPath: path, sessionOptions: options)
        guard let input = try session.inputNames().first else { throw NSError(domain: "Signify", code: 1) }
        self.inputName = input
        self.outputNames = Set(try session.outputNames())
        self.environment = env; self.model = session; self.loadedPath = uri
        self.startIfReady()
      } catch { self.fail("The recognition model could not load. You can still type a message.") }
    }
  }
  private func startIfReady() {
    guard requestedActive, model != nil else { return }
    guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
      fail("Allow camera access in Settings to recognize letters."); return
    }
    do {
      if !configured {
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) else {
          fail("A real phone is needed for the camera. You can type a message here."); return
        }
        capture.beginConfiguration()
        capture.sessionPreset = .vga640x480
        capture.automaticallyConfiguresApplicationAudioSession = false
        let input = try AVCaptureDeviceInput(device: device)
        let output = AVCaptureVideoDataOutput()
        output.alwaysDiscardsLateVideoFrames = true
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        output.setSampleBufferDelegate(self, queue: queue)
        guard capture.canAddInput(input), capture.canAddOutput(output) else {
          capture.commitConfiguration(); fail("This camera is unavailable. Close other camera apps and try again."); return
        }
        capture.addInput(input); capture.addOutput(output)
        if let connection = output.connection(with: .video) {
          connection.videoOrientation = .portrait
          connection.isVideoMirrored = false
        }
        capture.commitConfiguration(); configured = true
        DispatchQueue.main.async { [weak self] in
          self?.preview.connection?.videoOrientation = .portrait
          self?.preview.connection?.automaticallyAdjustsVideoMirroring = false
          self?.preview.connection?.isVideoMirrored = true
        }
      }
      try? AVAudioSession.sharedInstance().setAllowHapticsAndSystemSoundsDuringRecording(true)
      if !capture.isRunning { capture.startRunning() }
      emitStatus("live")
    } catch { if !configured { capture.commitConfiguration() }; fail("The camera could not start. Try again, or type your message.") }
  }
  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    let now = CACurrentMediaTime()
    guard requestedActive, now - lastFrameTime >= 0.083, let model,
          let buffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    lastFrameTime = now
    autoreleasepool {
      do {
        try VNImageRequestHandler(cvPixelBuffer: buffer, orientation: .up).perform([handRequest])
        guard let observation = handRequest.results?.first else { emitPrediction([], false, now); return }
        let points = try observation.recognizedPoints(.all).values.filter { $0.confidence > 0.3 }
        guard points.count >= 15 else { emitPrediction([], false, now); return }
        let image = CIImage(cvPixelBuffer: buffer)
        let w = image.extent.width, h = image.extent.height
        let xs = points.map { $0.location.x * w }, ys = points.map { $0.location.y * h }
        let minX = xs.min()!, maxX = xs.max()!, minY = ys.min()!, maxY = ys.max()!
        let margin = max(24, (maxX - minX) * 0.22)
        let crop = CGRect(x: minX - margin, y: minY - margin, width: maxX - minX + margin * 2, height: maxY - minY + margin * 2).intersection(image.extent)
        guard crop.width > 12, crop.height > 12 else { emitPrediction([], false, now); return }
        let tile = image.cropped(to: crop).transformed(by: CGAffineTransform(translationX: -crop.minX, y: -crop.minY)).transformed(by: CGAffineTransform(scaleX: 28 / crop.width, y: 28 / crop.height))
        var rgba = [UInt8](repeating: 0, count: 28 * 28 * 4)
        imageContext.render(tile, toBitmap: &rgba, rowBytes: 28 * 4, bounds: CGRect(x: 0, y: 0, width: 28, height: 28), format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
        var pixels = [Float](repeating: 0, count: 784)
        for i in 0..<784 {
          let j = i * 4
          let gray = (0.299 * Float(rgba[j]) + 0.587 * Float(rgba[j + 1]) + 0.114 * Float(rgba[j + 2])) / 255
          pixels[i] = (gray - 0.485) / 0.229
        }
        let data = pixels.withUnsafeBufferPointer { Data(buffer: $0) }
        let tensor = try ORTValue(tensorData: NSMutableData(data: data), elementType: .float, shape: [1, 1, 28, 28])
        let values = try model.run(withInputs: [inputName: tensor], outputNames: outputNames, runOptions: nil)
        guard let value = values.values.first else { return }
        let result = try value.tensorData() as Data
        let logits = result.withUnsafeBytes { Array($0.bindMemory(to: Float.self)) }
        let order: [VNHumanHandPoseObservation.JointName] = [.wrist, .thumbCMC, .thumbMP, .thumbIP, .thumbTip, .indexMCP, .indexPIP, .indexDIP, .indexTip, .middleMCP, .middlePIP, .middleDIP, .middleTip, .ringMCP, .ringPIP, .ringDIP, .ringTip, .littleMCP, .littlePIP, .littleDIP, .littleTip]
        let joints = try order.compactMap { name -> [String: Double]? in
          let point = try observation.recognizedPoint(name)
          guard point.confidence > 0.3 else { return nil }
          return ["x": Double(point.location.x), "y": Double(1 - point.location.y), "z": 0]
        }
        emitPrediction(logits, true, now, joints, Double(w), Double(h))
      } catch { fail("Recognition paused. Your message is safe. Try the camera again.") }
    }
  }
  private func emitPrediction(_ logits: [Float], _ hasHand: Bool, _ started: Double, _ landmarks: [[String: Double]] = [], _ width: Double = 0, _ height: Double = 0) {
    let elapsed = (CACurrentMediaTime() - started) * 1000
    DispatchQueue.main.async { [weak self] in self?.onPrediction(["logits": logits.map { Double($0) }, "hasHand": hasHand, "latencyMs": elapsed, "landmarks": landmarks, "width": width, "height": height]) }
  }
  private func emitStatus(_ state: String, _ message: String = "") {
    DispatchQueue.main.async { [weak self] in self?.onStatus(["state": state, "message": message]) }
  }
  private func fail(_ message: String) {
    requestedActive = false
    if capture.isRunning { capture.stopRunning() }
    emitStatus("error", message)
  }
}
