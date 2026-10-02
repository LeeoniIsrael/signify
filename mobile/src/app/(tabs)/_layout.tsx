import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { ScanLine, MessageCircle, BookOpen } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette, type } from "../../components/ui";
import { useSession } from "../../lib/session";
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const { feedback } = useSession();
  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
      tabBar={({ state, navigation }) =>
        keyboardVisible ? null : (
          <View style={[s.position, { bottom: Math.max(insets.bottom, 16) }]}>
            <BlurView intensity={65} tint="light" style={s.bar}>
              {state.routes.map((route, index) => {
                const selected = state.index === index;
                const Icon =
                  route.name === "index"
                    ? ScanLine
                    : route.name === "conversation"
                      ? MessageCircle
                      : BookOpen;
                const label =
                  route.name === "index"
                    ? "Translate"
                    : route.name === "conversation"
                      ? "Conversation"
                      : "Phrasebook";
                return (
                  <Pressable
                    key={route.key}
                    accessibilityRole="tab"
                    accessibilityLabel={label}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      feedback();
                      navigation.navigate(route.name);
                    }}
                    style={[s.tab, selected && s.selected]}
                  >
                    <Icon
                      size={17}
                      color={selected ? "#F0F6EB" : palette.muted}
                    />
                    <Text style={[s.label, selected && { color: "#F0F6EB" }]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </BlurView>
          </View>
        )
      }
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="conversation" />
      <Tabs.Screen name="phrases" />
    </Tabs>
  );
}
const s = StyleSheet.create({
  position: { position: "absolute", left: 18, right: 18 },
  bar: {
    flexDirection: "row",
    padding: 6,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "#E3EAE0E8",
    borderWidth: 1,
    borderColor: "#FFFFFFBB",
    boxShadow: "0 6px 25px #20302616",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 15,
    borderRadius: 27,
    minHeight: 49,
  },
  selected: { backgroundColor: palette.ink },
  label: { fontFamily: type.medium, fontSize: 10, color: palette.muted },
});
