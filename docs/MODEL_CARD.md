# Recognition model integration

## Source

The unchanged `signlanguage.onnx` and PyTorch checkpoint come from the copied source repository. The training source describes three convolutional layers, max pooling, and three fully connected layers ending in 25 logits. The dataset loader remaps the 24 Sign-MNIST labels into compact indices, excluding J (original index 9) and Z (index 25). Output indices 0–23 map to `ABCDEFGHIKLMNOPQRSTUVWXY`. Index 24 is unused and must never emit a letter.

## Browser pipeline

1. Explicit camera permission. No microphone in the video stream.
2. MediaPipe Hand Landmarker v1, float16, one hand, CPU delegate. Model URL: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`.
3. One bounding box around hand landmarks, with margin equal to 22% of hand width (minimum 24 pixels), clamped to image bounds. Reject negligible crops.
4. Resize to 28×28. Convert RGBA to grayscale using 0.299 R + 0.587 G + 0.114 B, divide by 255, then normalize `(value - 0.485) / 0.229`.
5. Input tensor `[1,1,28,28]`, float32. ONNX Runtime Web's single-thread WASM backend. No cross-origin isolation dependency.
6. Numerically stable softmax; reject non-finite/incorrectly sized logits, unused class, or confidence below 0.80.
7. Hold one candidate for 850 ms. Capture once until another stable letter is seen or the hand is absent for at least 450 ms. Uncertain predictions reset the hold interval but do not count as a physical release.
8. Show the original video mirrored, with equally mirrored landmarks. Model input uses the unmirrored camera pixels. No overlays are drawn into classifier input.

Inference runs serially, with 140 ms between completed predictions; no overlapping frame jobs and no inference on duplicate video frames. The CNN and hand detector are lazy-loaded after camera permission. Their initialized sessions are reused during the page visit. Camera shutdown invalidates pending asynchronous work so late frames cannot change messages.

## Native mobile pipeline

The mobile app bundles the exact same CNN and shares `src/lib/recognition.ts` with the browser. It uses native ONNX Runtime 1.24.3 with one inference thread. iOS locates a hand with Apple Vision (`VNDetectHumanHandPoseRequest`); Android uses CameraX and MediaPipe Tasks Vision 0.10.32 with the bundled Hand Landmarker. iOS requires at least 15 visible joints above 0.3 confidence. Android hand detection/presence/tracking thresholds are 0.65.

Both implementations use unmirrored, portrait-oriented front-camera frames, the same bounded 22%/24px hand margin, 28×28 grayscale normalization, and shared confidence/stability filtering. Inference is serial on a background queue, with a minimum 130 ms between sampled frames; stale frames are dropped. Only logits, hand presence, and timing cross the native bridge. Frames are neither serialized into JavaScript nor uploaded or recorded. The preview is mirrored for positioning.

Camera work stops on screen exit, app backgrounding, native view disposal, or inference failure. Camera permission is requested only when starting recognition. The preview demo is explicitly labeled and never commits sample letters to the conversation. iOS and Android use different hand trackers and resizing implementations: they require separate physical-device evaluation, and numerical equivalence of the camera pipelines is not asserted.

## Validation boundaries

Automated tests execute the actual browser WASM model using a held-out CSV example, exercise the complete pipeline using a generated hand photograph as a synthetic camera, and separately test normalization, compact labels, unsupported outputs, confidence rejection, and capture behavior. A synthetic stream is an integration test, not evidence of sign-language translation accuracy.

No clinical validation, signer-diverse real-world accuracy study, latency benchmark across phones, or human evaluation was performed. Do not advertise full sign language interpretation or a measured accuracy percentage from these checks. A production model should be evaluated with Deaf signers across lighting, backgrounds, skin tones, hand shapes, handedness, camera devices, and signing styles. Temporal sign language recognition needs an appropriate licensed dataset, temporal architecture, and language-specific evaluation beyond this static-letter CNN.
