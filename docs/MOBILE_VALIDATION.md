# Native mobile validation

Recorded for the React Native / Expo mobile implementation on October 2, 2026.

## Passed checks

- Expo SDK 57 dependency/configuration diagnostic: all 18 checks passed.
- Mobile ESLint and TypeScript checks: passed.
- iOS and Android production JavaScript export: passed; model weights, Manrope fonts, alphabet chart, and decorative photography are included.
- Shared classifier/stability tests: all five tests passed. Browser companion production build also passed.
- iOS native Debug and Release simulator builds with Xcode 27, arm64, signing disabled: passed. The Swift camera module and native ONNX Runtime were compiled and linked.
- Android native Debug APK, arm64-v8a: passed with Gradle 9.3.1 / Android SDK 36. The Kotlin camera module and CameraX/MediaPipe/ONNX dependencies compiled and linked. Android runtime UI and physical-camera checks were not performed.
- iPhone 17 Pro / iOS 26 simulator: release build installed and opened without Metro. Camera startup loaded the bundled CNN and returned the expected real-phone-required message rather than a model-load error.
- Native interface checks: labeled preview demo; phrase selection into a conversation; native keyboard editing; navigation dock hidden while typing; full-screen presentation; clear and undo restored the exact prior message; explicit phrase saving and persistence across app restart.

The simulator preview is a locally installed app, not a browser or embedded website. No store submission, signing registration, or cloud build was performed.

## Physical-device validation still required

A simulator cannot establish camera accuracy, real-world latency, battery impact, or tactile feedback. Evaluate the front-camera pipeline separately on iPhone and Android with Deaf signers, including handedness, skin tones, hand shapes, lighting, backgrounds, and camera orientation. Test repeat letters, uncertain signs, denied camera access, interruptions/backgrounding, speech availability, haptics enabled/disabled, system text scaling, and screen-reader navigation.

The inherited CNN recognizes 24 static ASL letters. These checks do not establish continuous sign-language translation or clinical suitability. See the [model card](MODEL_CARD.md).

## Dependency follow-up

The SDK 57 dependency tree currently reports npm advisories in inherited development/configuration dependencies (`node-forge`, `uuid`) and the router's `decode-uri-component` chain. The audit's proposed major downgrades to Expo 44 / Router 5 were not applied because they are incompatible with this app. Reassess these upstream dependencies before a public release. Package versions are pinned by `mobile/package-lock.json`.

## Expo Go recognition update

The Expo Go preview fallback has been replaced with an on-device MediaPipe/ONNX WASM processor fed by native Expo Camera snapshots. The main flow now says Sign to text, explains holding letters, and exposes message editing, spaces, deletion, speech, and full-screen presentation. The timer-only demo was removed.

The actual packaged processor passed integration checks in Chromium and WebKit: bundled models initialize, blank frames yield no hand or logits, a hand photograph yields 21 landmarks and 25 finite CNN outputs, and no HTTP requests occur during inference. Mobile lint, TypeScript, and iOS/Android production JS export passed. This tests the inference processor; physical Expo Go camera performance, recognition accuracy, and haptics remain unverified. The Mac was locked during this update, preventing a simulator UI check. These limits are separate from the earlier native build checks above.

## Session startup fix

The session context, state hook, provider component, and consumer hook now live in separate modules, preserving context identity when the provider refreshes. A local `mobile/index.js` entry loads Expo Router. Three regression tests verify nested consumers, a re-evaluated provider module, and the missing-provider guard. Mobile lint and TypeScript passed. Expo Go was cold-started in the iOS 26 simulator after clearing Metro: the translation screen opened, message editing and full-screen presentation shared session state, and a provider Fast Refresh kept the active message without a crash. Camera startup in Expo Go loaded the on-device hand tracker and CNN, reached Recognizing, and stopped cleanly. Simulator frames cannot validate signing accuracy or physical camera performance.
