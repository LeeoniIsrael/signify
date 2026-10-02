import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import * as ort from "onnxruntime-web/wasm";
import { classify, normalizeRgba } from "./recognition";

export type Landmark = { x: number; y: number; z: number };
export type FrameResult = {
  letter: string | null;
  confidence: number;
  landmarks: Landmark[];
  latency: number;
};
export class SignEngine {
  private hands: HandLandmarker;
  private session: ort.InferenceSession;
  private canvas = document.createElement("canvas");
  private constructor(hands: HandLandmarker, session: ort.InferenceSession) {
    this.hands = hands;
    this.session = session;
    this.canvas.width = 28;
    this.canvas.height = 28;
  }
  static async create() {
    ort.env.wasm.wasmPaths = {
      wasm: "/vendor/ort/ort-wasm-simd-threaded.wasm",
    };
    ort.env.wasm.numThreads = 1;
    const files = await FilesetResolver.forVisionTasks("/vendor/mediapipe");
    const hands = await HandLandmarker.createFromOptions(files, {
      baseOptions: {
        modelAssetPath: "/models/hand_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.65,
      minHandPresenceConfidence: 0.65,
      minTrackingConfidence: 0.65,
    });
    try {
      const session = await ort.InferenceSession.create(
        "/models/signlanguage.onnx",
        { executionProviders: ["wasm"] },
      );
      return new SignEngine(hands, session);
    } catch (error) {
      hands.close();
      throw error;
    }
  }
  async predict(video: HTMLVideoElement): Promise<FrameResult> {
    const start = performance.now();
    const result = this.hands.detectForVideo(video, start);
    const landmarks = result.landmarks[0] || [];
    if (!landmarks.length)
      return {
        letter: null,
        confidence: 0,
        landmarks,
        latency: performance.now() - start,
      };
    const w = video.videoWidth,
      h = video.videoHeight;
    const xs = landmarks.map((p) => p.x * w),
      ys = landmarks.map((p) => p.y * h);
    const margin = Math.max(24, (Math.max(...xs) - Math.min(...xs)) * 0.22);
    const left = Math.max(0, Math.min(...xs) - margin),
      top = Math.max(0, Math.min(...ys) - margin);
    const right = Math.min(w, Math.max(...xs) + margin),
      bottom = Math.min(h, Math.max(...ys) + margin);
    if (right - left < 12 || bottom - top < 12)
      return {
        letter: null,
        confidence: 0,
        landmarks,
        latency: performance.now() - start,
      };
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(video, left, top, right - left, bottom - top, 0, 0, 28, 28);
    const tensor = new ort.Tensor(
      "float32",
      normalizeRgba(ctx.getImageData(0, 0, 28, 28).data),
      [1, 1, 28, 28],
    );
    const output = await this.session.run({
      [this.session.inputNames[0]]: tensor,
    });
    const prediction = classify(
      output[this.session.outputNames[0]].data as Float32Array,
    );
    tensor.dispose();
    Object.values(output).forEach((t) => t.dispose());
    return { ...prediction, landmarks, latency: performance.now() - start };
  }
  async close() {
    this.hands.close();
    await this.session.release();
  }
}
