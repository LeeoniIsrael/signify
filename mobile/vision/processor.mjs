import { HandLandmarker } from '@mediapipe/tasks-vision';
import * as ort from 'onnxruntime-web/wasm';
import { normalizeRgba } from '../../src/lib/recognition.ts';

// This isolated on-device processor has no camera or network access.
const files = new Map();
const parts = new Map();
const urls = [];
let hands;
let session;
let busy = false;
const tile = document.createElement('canvas');
tile.width = tile.height = 28;
const context = tile.getContext('2d', { willReadFrequently: true });
const post = (message) => window.ReactNativeWebView.postMessage(JSON.stringify(message));
function bytes(base64) {
  const decoded = atob(base64);
  const result = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) result[i] = decoded.charCodeAt(i);
  return result;
}
function blob(name, type) {
  const url = URL.createObjectURL(new Blob([files.get(name)], { type }));
  urls.push(url);
  return url;
}
async function initialize() {
  post({ type: 'status', state: 'loading', message: 'Starting hand tracking…' });
  hands = await HandLandmarker.createFromOptions({
    wasmLoaderPath: blob('mpLoader', 'text/javascript'),
    wasmBinaryPath: blob('mpWasm', 'application/wasm'),
  }, {
    baseOptions: { modelAssetBuffer: files.get('hands'), delegate: 'CPU' },
    runningMode: 'VIDEO', numHands: 1,
    minHandDetectionConfidence: 0.65, minHandPresenceConfidence: 0.65,
    minTrackingConfidence: 0.65,
  });
  post({ type: 'status', state: 'loading', message: 'Starting the letter model…' });
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = {
    mjs: blob('ortLoader', 'text/javascript'),
    wasm: blob('ortWasm', 'application/wasm'),
  };
  session = await ort.InferenceSession.create(files.get('cnn'), { executionProviders: ['wasm'] });
  files.clear(); parts.clear();
  post({ type: 'ready' });
}
async function frame(payload) {
  if (busy || !session || !hands) return;
  busy = true;
  const started = performance.now();
  try {
    const image = new Image();
    image.src = 'data:image/jpeg;base64,' + payload.base64;
    await image.decode();
    const width = image.naturalWidth, height = image.naturalHeight;
    const result = hands.detectForVideo(image, started);
    const landmarks = result.landmarks[0] || [];
    const prediction = { type: 'prediction', id: payload.id, logits: [], hasHand: false, landmarks, width, height };
    if (landmarks.length) {
      const xs = landmarks.map(p => p.x * width), ys = landmarks.map(p => p.y * height);
      const margin = Math.max(24, (Math.max(...xs) - Math.min(...xs)) * 0.22);
      const left = Math.max(0, Math.min(...xs) - margin), top = Math.max(0, Math.min(...ys) - margin);
      const right = Math.min(width, Math.max(...xs) + margin), bottom = Math.min(height, Math.max(...ys) + margin);
      if (right - left >= 12 && bottom - top >= 12) {
        context.drawImage(image, left, top, right-left, bottom-top, 0, 0, 28, 28);
        const tensor = new ort.Tensor('float32', normalizeRgba(context.getImageData(0, 0, 28, 28).data), [1,1,28,28]);
        let output;
        try {
          output = await session.run({ [session.inputNames[0]]: tensor });
          prediction.logits = Array.from(output[session.outputNames[0]].data);
          prediction.hasHand = true;
        } finally {
          tensor.dispose();
          if (output) Object.values(output).forEach(t => t.dispose());
        }
      }
    }
    image.src = '';
    post({ ...prediction, latencyMs: performance.now() - started });
  } finally { busy = false; }
}
window.SignifyVision = {
  async receive(packet) {
    try {
      if (packet.type === 'begin') parts.set(packet.name, []);
      if (packet.type === 'part') parts.get(packet.name).push(packet.data);
      if (packet.type === 'end') {
        files.set(packet.name, bytes(parts.get(packet.name).join('')));
        parts.delete(packet.name);
      }
      if (packet.type === 'initialize') await initialize();
      if (packet.type === 'frame') await frame(packet);
      if (packet.seq !== undefined) post({ type: 'ack', seq: packet.seq });
    } catch (error) {
      post({ type: 'error', message: String(error?.message || error) });
    }
  },
};
window.addEventListener('unload', () => {
  hands?.close(); session?.release(); urls.forEach(url => URL.revokeObjectURL(url));
});
post({ type: 'boot' });
