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

Both implementations use unmirrored, portrait-oriented front-camera frames, the same bounded 22%/24px hand margin, 28×28 grayscale normalization, and shared confidence/stability filtering. Inference is serial on a background queue, with a minimum 83 ms between sampled frames; stale frames are dropped. Only logits, hand presence, normalized hand joints, image dimensions, and timing cross the native bridge. Frames are neither serialized into JavaScript nor uploaded or recorded. The preview is mirrored for positioning.

Camera work stops on screen exit, app backgrounding, native view disposal, or inference failure. Camera permission is requested only when starting recognition. iOS and Android use different hand trackers and resizing implementations: they require separate physical-device evaluation, and numerical equivalence of the camera pipelines is not asserted.

## Expo Go mobile pipeline

Expo Go reads continuous front-camera video in a local WebView using MediaPipe Tasks Vision 0.10.32 and ONNX Runtime Web 1.24.3. Runtime files and model buffers are bundled and loaded through Blob URLs. The HTML is supplied locally; the base URL `https://signify.local/` establishes a secure camera origin and is not fetched. A restrictive content security policy blocks HTTP requests. Camera permission is explicitly requested through the native permission API. Asset transfer is chunked and acknowledged.

Fresh video frames are processed serially at a target of 12 Hz. No image files or JPEG bridge transfers are needed for this path. If continuous capture is unavailable, native Expo Camera supplies serial snapshots near 640×480 with no intentional pause after inference; temporary files are deleted immediately after reading. Both paths use the original crop, grayscale normalization, label mapping, and CNN weights. The CNN is warmed once after initialization.

Expo Go rejects negligible or clipped hand crops and suppresses capture while joints move substantially relative to palm size. Mobile capture requires two agreeing confident predictions among the last three, a 550 ms stable candidate with at least three samples, and a 300 ms physical hand release for repeats. A gap above 1,000 ms resets the candidate; stale or uncertain processing does not count as physical hand release. Confidence remains 0.80. These filters improve capture behavior without retraining or establishing a higher model accuracy.

Pause stops camera tracks while retaining loaded models. Screen exit and backgrounding stop capture; generation checks discard late predictions after pause or restart. The visible skeleton uses actual normalized joints, mirrored to match the preview; the scanning animation stops on stale tracking and respects reduced motion. Initialization and camera failures surface a retry state. Physical-device latency and accuracy still need evaluation.

## Validation boundaries

Automated tests execute the actual browser WASM model using a held-out CSV example, exercise the complete pipeline using a generated hand photograph as a synthetic camera, and separately test normalization, compact labels, unsupported outputs, confidence rejection, and capture behavior. The Expo Go processor is additionally tested in Chromium and WebKit with its actual packaged runtimes: both models initialize, an empty frame produces no hand or logits, a hand photograph produces 21 landmarks and 25 finite CNN logits, continuous video produces real CNN predictions, pause stops tracks and late predictions, and no HTTP requests occur. A synthetic stream or photo is an integration test, not evidence of sign-language translation accuracy.

No clinical validation, signer-diverse real-world accuracy study, latency benchmark across phones, or human evaluation was performed. Do not advertise full sign language interpretation or a measured accuracy percentage from these checks. A production model should be evaluated with Deaf signers across lighting, backgrounds, skin tones, hand shapes, handedness, camera devices, and signing styles. Temporal sign language recognition needs an appropriate licensed dataset, temporal architecture, and language-specific evaluation beyond this static-letter CNN.
