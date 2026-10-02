import {
  requireNativeViewManager,
  requireOptionalNativeModule,
} from "expo-modules-core";
import type { ComponentType } from "react";
import type { ViewProps } from "react-native";
export type CameraPrediction = {
  logits: number[];
  hasHand: boolean;
  latencyMs: number;
  landmarks?: { x: number; y: number; z: number }[];
  width?: number;
  height?: number;
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

// Lazy-load the Expo Go processor; installed native builds use the streaming native module.
export const SignifyCamera: ComponentType<Props> = hasNativeRecognition
  ? (requireNativeViewManager("SignifyCamera") as ComponentType<Props>)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./ExpoCameraEngine").default;
