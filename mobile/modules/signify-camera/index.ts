import { requireNativeViewManager } from "expo-modules-core";
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
export const SignifyCamera = requireNativeViewManager(
  "SignifyCamera",
) as ComponentType<Props>;
