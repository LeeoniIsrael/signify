# Signify

**A little less distance.** A camera-assisted fingerspelling and conversation app with a quiet glass interface, local AI, editable text, and speech.

This repository preserves the history, trained CNN, datasets, and original Flask prototype from [LeeoniIsrael/sign-language-interpreter](https://github.com/LeeoniIsrael/sign-language-interpreter), originally forked from [sonialiao/SEO_FinalProject](https://github.com/sonialiao/SEO_FinalProject). The modern browser app lives in `src/`. The original project description is preserved in [docs/ORIGINAL_README.md](docs/ORIGINAL_README.md).

## Run

Use Node.js 22 LTS (see `.nvmrc`). No Python server, account, or API key is needed for the modern app.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Camera access requires **HTTPS or localhost**. To test on a physical phone, serve the production build over HTTPS; a plain HTTP LAN address will not permit camera access. `npm run build` creates a self-contained `dist/` directory for a static HTTPS host at the domain root. `npm run preview` previews it locally. No website has been deployed by this repository setup.

`npm ci` copies the pinned MediaPipe/ONNX runtime files, original CNN, and reference chart into public assets. Hand-tracking weights are checked in. Runtime model inference and fonts are served from the same origin; no third-party CDN is required at runtime. Initial camera startup downloads approximately 30 MB of model and runtime resources from the app's host, cached normally by the browser.

## What works

- Your device camera → MediaPipe hand landmarks → bounded hand crop → 28×28 grayscale and original normalization → the inherited ONNX CNN.
- 24 static ASL letters, uncertainty rejection, an 850 ms stability window, and release-to-repeat capture. A hand release of at least 450 ms lets you enter a repeated letter.
- Editable message, spaces and deletion, explicit text-to-speech, copy, full-screen display, and personal saved phrases.
- Two-way typed conversation and opt-in browser speech captions, with a provider/privacy notice before microphone use.
- Everyday, café, transport, and appointment phrasebooks, plus a getting-started guide and original alphabet chart.
- Optional haptic capture feedback on browsers with the Vibration API, visual confirmation on all devices, large text, higher contrast, keyboard focus, and OS reduced-motion support.
- Camera denial/disconnection/model-load recovery. Camera and speech stop when the page goes into the background; camera tracks also stop on navigation away from Translate.

## Model scope and limitations

**This is experimental fingerspelling recognition, not full sign language translation.** The inherited Sign-MNIST model does not model movement, face/body grammar, two-handed signs, words, or signed sentences. J and Z must be typed. Full continuous sign language interpretation requires a separately trained and validated temporal model and Deaf-led evaluation.

The model's 25 logits include one unused class. The app rejects that class and predictions below 0.80 softmax confidence. Confidence is not calibrated correctness. A held-out dataset smoke test checks model loading and label mapping; it does not establish real-camera accuracy. Background, lighting, camera orientation, hand shape, and skin tone can affect results. Review every message before speaking or presenting it. In critical contexts, use a qualified interpreter.

See [docs/MODEL_CARD.md](docs/MODEL_CARD.md) for exact preprocessing and validation boundaries.

## Privacy and browser support

Camera frames are neither uploaded nor recorded. Conversation text stays in memory for the current visit. Only explicitly saved phrases and preferences persist in browser local storage. Anyone using the same browser profile can see saved phrases. Clearing site data removes them.

Live captions depend on the browser's SpeechRecognition API and may send audio to that browser's provider. Text-to-speech uses the browser's configured voice; availability and local versus service-backed voices vary by device. Neither captions nor vibration is supported everywhere. Safari/iOS commonly lack web vibration; visual feedback remains available. Typing and presenting text remain usable without camera, microphone, or speech support.

## Verify

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

For an existing Google Chrome installation: `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.

Tests cover model label safety, normalization, capture stability, uncertainty, repeats, real ONNX inference on a held-out sample, the full MediaPipe/CNN pipeline using a synthetic camera stream, camera denial and stopping, message display/editing, saved phrases, responsive overflow, and automated accessibility checks. Physical camera accuracy, tactile feedback on a phone, and live microphone recognition still require device testing.

## Project map

- `src/App.tsx`: conversation interface and camera/speech lifecycle.
- `src/lib/engine.ts`: local hand detection and ONNX inference.
- `src/lib/recognition.ts`: preprocessing, class mapping, confidence rejection, stability gate.
- `src/styles.css`: responsive design and accessibility preferences.
- `signlanguage.onnx`, `classifier_model/`: inherited research model and training sources.
- `app.py`, `templates/`, `static/`, `requirements.txt`: preserved historical Flask prototype; not the entry point for the redesigned app.
- `docs/DESIGN.md`: design decisions, artwork provenance, and generation prompt.

## Attribution

The upstream research project, model, dataset copies, and alphabet chart retain their original provenance; this work does not assign a new license to upstream assets. The hand-tracking model comes from Google's [MediaPipe model distribution](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker). Runtime and font attribution is recorded in [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md). The welcome hand study was generated for this project and is not an instructional sign illustration.
