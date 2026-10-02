# Asset and dependency attribution

- Original Signify research sources, trained ONNX/PyTorch weights, Sign-MNIST dataset copies, and ASL reference chart: preserved from [LeeoniIsrael/sign-language-interpreter](https://github.com/LeeoniIsrael/sign-language-interpreter), forked from [sonialiao/SEO_FinalProject](https://github.com/sonialiao/SEO_FinalProject). The copied tree does not supply a project license; no new license is asserted for those original assets.
- MediaPipe Tasks Vision 0.10.32: Apache-2.0, [Google MediaPipe](https://github.com/google-ai-edge/mediapipe). The hand landmark model is the official v1 float16 distribution; exact origin appears in the model card.
- ONNX Runtime Web 1.24.3: MIT, [Microsoft ONNX Runtime](https://github.com/microsoft/onnxruntime).
- React / React DOM: MIT, [React](https://github.com/facebook/react).
- Lucide icons: ISC, [Lucide](https://github.com/lucide-icons/lucide).
- Manrope and DM Sans: SIL Open Font License 1.1, locally served through their `@fontsource` packages. Source license files remain in those npm packages.
- `public/hand-study.png`: new decorative artwork generated for this app with the built-in image generation tool; full prompt in `DESIGN.md`.

Exact dependency versions and transitive dependencies are recorded in `package-lock.json`.
