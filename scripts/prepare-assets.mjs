import { mkdir, cp, copyFile } from "node:fs/promises";
await mkdir("public/vendor", { recursive: true });
await cp(
  "node_modules/@mediapipe/tasks-vision/wasm",
  "public/vendor/mediapipe",
  { recursive: true },
);
await mkdir("public/vendor/ort", { recursive: true });
for (const file of [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
]) {
  await copyFile(
    `node_modules/onnxruntime-web/dist/${file}`,
    `public/vendor/ort/${file}`,
  );
}
await mkdir("public/models", { recursive: true });
await copyFile("signlanguage.onnx", "public/models/signlanguage.onnx");
await copyFile("static/ASL_chart.jpg", "public/asl-chart.jpg");
