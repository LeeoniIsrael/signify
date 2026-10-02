import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
await mkdir("mobile/assets/vision", { recursive: true });
await build({
  entryPoints: ["mobile/vision/processor.mjs"],
  outfile: "mobile/assets/vision/processor.cvdata",
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "inline",
});
for (const [source, target] of [
  [
    "node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js",
    "mp-loader",
  ],
  [
    "node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm",
    "mp-wasm",
  ],
  [
    "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs",
    "ort-loader",
  ],
  ["node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm", "ort-wasm"],
])
  await copyFile(source, `mobile/assets/vision/${target}.cvdata`);
