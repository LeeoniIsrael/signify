import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ArrowUpRight, Hand, X } from "lucide-react-native";
import { router } from "expo-router";
import { useSession } from "../lib/session";
export const palette = {
  background: "#EDF0EE",
  paper: "#F8FAF6",
  ink: "#28372E",
  muted: "#596D5D",
  sage: "#6F8B73",
  line: "#D8E1D7",
  soft: "#E2EADF",
};
export const type = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semi: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
};
export function Label({
  children,
  light = false,
}: {
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <Text style={[u.label, light && { color: "#F0F5EE" }]}>{children}</Text>
  );
}
export function Action({
  title,
  icon,
  onPress,
  secondary = false,
  disabled = false,
  style,
  testID,
}: {
  title: string;
  icon?: ReactNode;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        u.action,
        secondary && u.secondary,
        disabled && { opacity: 0.42 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {icon}
      <Text style={[u.actionText, secondary && { color: palette.ink }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function IconButton({
  label,
  onPress,
  children,
  light = false,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        u.icon,
        light && { backgroundColor: "#ffffff28" },
        pressed && { opacity: 0.6 },
      ]}
    >
      {children}
    </Pressable>
  );
}
export function Brand() {
  return (
    <View style={u.brand}>
      <View style={u.mark}>
        <Hand size={21} color="#EDF4EA" strokeWidth={1.6} />
      </View>
      <Text style={u.wordmark}>
        signify<Text style={{ color: palette.sage }}>.</Text>
      </Text>
    </View>
  );
}
export function SheetHeader({ title }: { title: string }) {
  return (
    <View style={u.sheetHeader}>
      <Text accessibilityRole="header" style={u.sheetTitle}>
        {title}
      </Text>
      <IconButton label="Close" onPress={() => router.back()}>
        <X size={21} color={palette.ink} />
      </IconButton>
    </View>
  );
}
export function Toast() {
  const { toast, setToast } = useSession();
  if (!toast) return null;
  return (
    <View pointerEvents="box-none" style={u.toastPosition}>
      <View accessibilityLiveRegion="polite" style={u.toast}>
        <Text style={u.toastText}>{toast.text}</Text>
        {toast.undo && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              toast.undo?.();
              setToast(null);
            }}
            style={{ padding: 10 }}
          >
            <Text style={u.undo}>Undo</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
export function Arrow() {
  return <ArrowUpRight size={18} color={palette.muted} />;
}
const u = StyleSheet.create({
  label: {
    fontFamily: type.medium,
    fontSize: 11,
    lineHeight: 18,
    color: palette.muted,
  },
  action: {
    minHeight: 52,
    paddingHorizontal: 19,
    paddingVertical: 13,
    borderRadius: 17,
    backgroundColor: palette.ink,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  secondary: {
    backgroundColor: palette.soft,
    borderWidth: 1,
    borderColor: palette.line,
  },
  actionText: { fontFamily: type.semi, fontSize: 13, color: "#F4F9EF" },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paper,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  mark: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: palette.ink,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-7deg" }],
  },
  wordmark: {
    fontFamily: type.bold,
    fontSize: 29,
    letterSpacing: -1.8,
    color: palette.ink,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 25,
    gap: 15,
  },
  sheetTitle: {
    fontFamily: type.medium,
    fontSize: 24,
    letterSpacing: -0.8,
    color: palette.ink,
    flex: 1,
  },
  toastPosition: {
    position: "absolute",
    bottom: 110,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  toast: {
    borderRadius: 19,
    paddingHorizontal: 19,
    paddingVertical: 15,
    backgroundColor: "#28372EF5",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    boxShadow: "0 8px 25px #18291C22",
  },
  toastText: {
    fontFamily: type.medium,
    fontSize: 12,
    lineHeight: 19,
    color: "#F3F8EF",
    flex: 1,
  },
  undo: {
    fontFamily: type.bold,
    fontSize: 12,
    color: "#E4F0DC",
    textDecorationLine: "underline",
  },
});
