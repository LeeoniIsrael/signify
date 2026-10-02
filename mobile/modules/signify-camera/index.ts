import {
  requireNativeViewManager,
  requireOptionalNativeModule,
} from "expo-modules-core";
import { CameraView } from "expo-camera";
import { createElement } from "react";
import type { ComponentType } from "react";
import type { ViewProps } from "react-native";
export type CameraPrediction = {
  logits: number[];
  hasHand: boolean;
  latencyMs: number;
};
export type CameraStatus = {
  state: "loading" | "live" | "error";
  message?: string;
};
export type Props = ViewProps & {
  active: boolean;
  modelPath: string;
  handModelPath: string;
  onPrediction: (event: { nativeEvent: CameraPrediction }) => void;
  onStatus: (event: { nativeEvent: CameraStatus }) => void;
};
export const hasNativeRecognition =
  !!requireOptionalNativeModule("SignifyCamera");

function ExpoGoPreview({ style, active, onStatus }: Props) {
  return createElement(CameraView, {
    style,
    facing: "front",
    active,
    onCameraReady: () => onStatus({ nativeEvent: { state: "live" } }),
    onMountError: () =>
      onStatus({
        nativeEvent: {
          state: "error",
          message:
            "The camera preview is unavailable. You can still type a message.",
        },
      }),
  });
}

// Expo Go cannot include our custom CNN module. Its preview never emits predictions.
export const SignifyCamera: ComponentType<Props> = hasNativeRecognition
  ? (requireNativeViewManager("SignifyCamera") as ComponentType<Props>)
  : ExpoGoPreview;
