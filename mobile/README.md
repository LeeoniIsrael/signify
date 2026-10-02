# Signify for iOS and Android

The primary Signify app is a native React Native / Expo application. It carries the soft monochrome photography, frosted controls, and calm typography of the browser design into real phone screens. Camera capture, haptics, speech, text inputs, navigation, and storage use native components. Hand tracking and CNN inference run on-device in both Expo Go and installed native builds.

## Test recognition in Expo Go

Install the current Expo Go app on your phone, connect the phone and computer to the same Wi-Fi, then run:

```sh
cd mobile
npm ci
npm run go -- --port 8083
```

Scan the terminal QR code with your iPhone camera or Expo Go on Android. Tap **Start translating**, allow camera access, and wait for the bundled models to load (the first development launch downloads about 32 MB from your computer). Face your palm toward the front camera and hold one static ASL letter until the bar fills. Accepted letters build your message with visible and haptic confirmation. Lower your hand briefly to repeat a letter; use Space between words. Edit errors in Conversation, then Speak or Show your message. J and Z must be typed. This is experimental fingerspelling, not full signed-sentence translation.

Expo Go uses native Expo Camera with serial JPEG snapshots, MediaPipe Hand Landmarker, and the original CNN in an isolated, invisible on-device WASM processor. All runtime files and weights are bundled locally; inference never contacts a server. One frame is processed at a time, with a 150 ms gap after completion. The processor has no UI or camera access. A Signify development/release build uses the faster native streaming module instead.

## Local development

Use Node.js 22 LTS (22.13 or newer). Install Xcode and CocoaPods for iOS, or Android Studio, Android SDK 36, and JDK 17+ for Android. Expo SDK 57 requires an appropriate current Xcode version; this project was built with Xcode 27. Keep the whole repository together: Metro imports the tested recognition logic from `../src/lib/recognition.ts`.

```sh
cd mobile
npm ci
npm run ios
# or
npm run android
```

`expo run:ios` / `expo run:android` generate the native projects, link the local camera module, compile, install, and start Metro. `ios/` and `android/` are generated and ignored; edit `app.json` or the local module instead. After native changes, rebuild the app. After JavaScript-only changes, `npm start` runs the development server.

For a connected iPhone:

```sh
npx expo run:ios --device
```

Enable Developer Mode on the phone and use an Apple development team for signing. A simulator can exercise the interface, model initialization, typing, phrases, and speech; it cannot validate physical camera recognition or tactile feedback. Expo Go uses the WASM processor instead of the custom native module.

If another project uses Metro's default port, choose a free one:

```sh
npx expo start --dev-client --port 8083
```

## Installable builds

`eas.json` includes development, iOS simulator, internal preview, and production profiles. After connecting this project to your Expo account:

```sh
npx eas-cli@latest build --platform ios --profile development
npx eas-cli@latest build --platform android --profile preview
```

The Android preview profile creates an APK; iOS distribution needs Apple signing and registered devices for an internal build. Production profiles are ready for your signing setup, app metadata, and store review. No app has been submitted to either store. An installed release includes model weights and fonts and does not require Metro or an inference server.

## Recognition and UX

- Explicit camera start, local front-camera preview, hold progress, suggested letters, and clear stop/retry states.
- Expo Go: Expo Camera → on-device MediaPipe hand landmarks → cropped pixels → ONNX Runtime WASM. All weights and runtimes are included.
- Native iOS: AVFoundation → Apple Vision hand joints → cropped pixels → native ONNX Runtime. Android: CameraX → MediaPipe hand landmarks → cropped pixels → native ONNX Runtime.
- The original 24-letter static ASL CNN, confidence rejection, 850 ms hold, and 450 ms hand release for repeats. J and Z must be typed. This is experimental fingerspelling, not continuous signed-language translation.
- Native haptic selection/capture feedback with an off switch. Hardware/OS settings, low-power mode, and active camera capture can suppress vibrations, especially on iOS; visible confirmation remains available.
- Editable messages, native speech, clipboard copy, full-screen presentation, two-way typing, built-in phrase categories, personal phrases, and undo after clear/replacement.
- Screen-reader labels, native font scaling, an additional large-message setting, stronger card outlines, minimum touch targets, reduced-motion support, safe areas, scrolling on small screens, and a dock that hides while typing.

## Privacy

Camera frames stay on the phone and are never uploaded. Expo Go temporarily writes each camera snapshot to the app cache and deletes it immediately after reading; the in-memory JPEG is passed only to the isolated local processor. No recording or snapshot history is kept. Current message/reply text lives in memory and clears when the app process ends. Backgrounding stops capture and speech. Explicitly saved phrases and preferences use local AsyncStorage; device backups may include this app data. Saved phrases are not encrypted by the app, so avoid saving sensitive text on a shared device.

Text-to-speech uses the device's configured speech engine. Keyboard dictation is provided by the OS/keyboard and follows that provider's privacy settings. Signify does not request microphone permission or implement a separate audio-upload service. Model/font assets are packaged with release builds; development builds fetch assets from Metro during development.

## Checks

```sh
npm run lint
npm run typecheck
npm run doctor
npm run export
cd ..
npm test
npm run test:mobile-vision
```

`export` produces both native JavaScript bundles; it is not a substitute for compiling Swift/Kotlin. Native compilation is exercised with `expo run:ios` and `expo run:android`. See [validation notes](../docs/MOBILE_VALIDATION.md) for this change's recorded results and physical-device checklist. Model limits and preprocessing are described in the [model card](../docs/MODEL_CARD.md).

The processor source lives in `vision/processor.mjs`. From the repository root, run `npm run build:mobile-vision` after changing it. Commit the generated `mobile/assets/vision/*.cvdata` files so mobile-only installs can load the local processor without a root build.
