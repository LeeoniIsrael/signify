import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Square, Volume2 } from "lucide-react-native";
import { useSession } from "../lib/session";
import { Action, SheetHeader, palette, type } from "../components/ui";
export default function Present() {
  const { message, speak, speaking } = useSession();
  return (
    <SafeAreaView style={s.page}>
      <SheetHeader title="Your message" />
      <ScrollView contentContainerStyle={s.messageContainer}>
        <Text
          selectable
          style={[
            s.message,
            {
              fontSize:
                message.length > 200 ? 32 : message.length > 70 ? 40 : 52,
            },
          ]}
        >
          {message || "A little less distance."}
        </Text>
      </ScrollView>
      <View style={s.bottom}>
        <Text style={s.caption}>Take your time. We’re listening.</Text>
        <Action
          title={speaking ? "Stop speaking" : "Speak message"}
          disabled={!message.trim()}
          onPress={speak}
          icon={
            speaking ? (
              <Square size={19} color="white" />
            ) : (
              <Volume2 size={19} color="white" />
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper, padding: 25 },
  messageContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 30,
  },
  message: {
    fontFamily: type.medium,
    letterSpacing: -1.3,
    color: palette.ink,
    textAlign: "center",
  },
  bottom: { gap: 19, paddingBottom: 10 },
  caption: {
    fontFamily: type.regular,
    fontSize: 13,
    color: palette.muted,
    textAlign: "center",
  },
});
