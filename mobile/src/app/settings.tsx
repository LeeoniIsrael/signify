import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Expand, Hand, ScanLine, Smartphone } from "lucide-react-native";
import { useSession } from "../lib/session";
import { Action, SheetHeader, palette, type } from "../components/ui";
export default function Settings() {
  const { preferences, updatePreference, feedback } = useSession();
  return (
    <SafeAreaView edges={["top", "bottom"]} style={s.page}>
      <ScrollView contentContainerStyle={s.content}>
        <SheetHeader title="Make yourself comfortable." />
        <Text style={s.intro}>
          A few small adjustments.{"\n"}A better experience for you.
        </Text>
        {[
          {
            key: "haptics" as const,
            title: "Haptic feedback",
            body: "Gentle taps for actions and captured letters. Your phone may limit haptics while the camera is active or in Low Power Mode.",
            Icon: Smartphone,
          },
          {
            key: "largeText" as const,
            title: "Larger message text",
            body: "A little more room for your words.",
            Icon: Expand,
          },
          {
            key: "highContrast" as const,
            title: "Stronger message outline",
            body: "Make the conversation easier to find.",
            Icon: ScanLine,
          },
        ].map(({ key, title, body, Icon }) => (
          <View key={key} style={s.row}>
            <Icon size={22} color={palette.sage} />
            <View style={{ flex: 1, gap: 7 }}>
              <Text style={s.name}>{title}</Text>
              <Text style={s.body}>{body}</Text>
            </View>
            <Switch
              accessibilityLabel={title}
              value={preferences[key]}
              onValueChange={(v) => {
                updatePreference(key, v);
                feedback();
              }}
              trackColor={{ false: "#CAD6C5", true: palette.sage }}
            />
          </View>
        ))}
        <View style={s.note}>
          <Hand size={26} color={palette.muted} />
          <Text style={s.noteTitle}>Designed around you.</Text>
          <Text style={s.body}>
            Motion follows your phone’s Reduce Motion preference. Text follows
            system scaling. Visual feedback is always available, even without
            vibration.
          </Text>
        </View>
        <Action
          title="A hand getting started"
          secondary
          onPress={() => router.replace("/guide")}
        />
        <Text style={s.footer}>
          Signify 1.0 · An early step toward understanding.{"\n"}No accounts. No
          camera uploads.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.background },
  content: { padding: 25, paddingBottom: 40 },
  intro: {
    fontFamily: type.regular,
    fontSize: 14,
    lineHeight: 23,
    color: palette.muted,
    marginBottom: 23,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderColor: palette.line,
  },
  name: { fontFamily: type.semi, fontSize: 14, color: palette.ink },
  body: {
    fontFamily: type.regular,
    fontSize: 12,
    lineHeight: 21,
    color: palette.muted,
  },
  note: {
    marginVertical: 15,
    padding: 23,
    borderRadius: 23,
    backgroundColor: "#E1E9DB",
    gap: 13,
  },
  noteTitle: {
    fontFamily: type.medium,
    fontSize: 23,
    letterSpacing: -0.8,
    color: palette.ink,
  },
  footer: {
    fontFamily: type.regular,
    fontSize: 10,
    lineHeight: 19,
    textAlign: "center",
    color: palette.muted,
    marginTop: 26,
  },
});
