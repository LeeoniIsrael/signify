import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, Hand, MessageCircle } from "lucide-react-native";
import { Action, Label, SheetHeader, palette, type } from "../components/ui";
export default function Guide() {
  return (
    <SafeAreaView style={s.page} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={s.content}>
        <SheetHeader title="A hand getting started." />
        {[
          {
            Icon: Camera,
            title: "Find your light.",
            body: "Face the front camera in even light. Keep one hand fully visible against a simple background.",
          },
          {
            Icon: Hand,
            title: "One letter at a time.",
            body: "Hold a static ASL letter for about a second. The bar fills as it settles. Lower your hand briefly to repeat a letter.",
          },
          {
            Icon: MessageCircle,
            title: "Make the message yours.",
            body: "Review each letter, add spaces, and edit anything in Conversation. Then speak your message or show it in large text.",
          },
        ].map(({ Icon, title, body }, i) => (
          <View key={title} style={s.step}>
            <View style={s.icon}>
              <Icon size={23} color={palette.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Label>Step {i + 1}</Label>
              <Text style={s.title}>{title}</Text>
              <Text style={s.body}>{body}</Text>
            </View>
          </View>
        ))}
        <View style={s.alphabet}>
          <Label>A reference within reach</Label>
          <Text style={s.alphabetTitle}>The ASL alphabet.</Text>
          <Image
            source={require("../../assets/asl-chart.jpg")}
            accessibilityLabel="ASL alphabet reference, letters A through Z"
            resizeMode="contain"
            style={s.chart}
          />
          <Text style={s.body}>
            The camera supports 24 static letters. J and Z require movement;
            type them manually.
          </Text>
          <Action
            title="Learn with ASL University"
            secondary
            onPress={() =>
              void Linking.openURL(
                "https://www.lifeprint.com/asl101/fingerspelling/fingerspelling.htm",
              )
            }
          />
        </View>
        <Text style={s.title}>An early step, with room to grow.</Text>
        <Text style={s.body}>
          Sign languages include movement, facial expression, and their own
          grammar. This research CNN recognizes static fingerspelling, not full
          signed sentences. It can make mistakes. Use a qualified interpreter
          for critical conversations.
        </Text>
        <Text style={[s.body, { marginTop: 15 }]}>
          Video is processed on this phone and is never recorded or uploaded.
          Saved phrases stay in local storage. Your keyboard’s dictation and
          installed speech voices follow your phone’s speech-service settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.background },
  content: { padding: 25, paddingBottom: 40 },
  step: { flexDirection: "row", gap: 17, marginBottom: 29 },
  icon: {
    height: 47,
    width: 47,
    backgroundColor: palette.soft,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontFamily: type.medium,
    fontSize: 21,
    letterSpacing: -0.6,
    color: palette.ink,
    marginTop: 3,
    marginBottom: 8,
  },
  body: {
    fontFamily: type.regular,
    fontSize: 13,
    lineHeight: 23,
    color: palette.muted,
  },
  alphabet: {
    backgroundColor: palette.paper,
    padding: 21,
    borderRadius: 25,
    gap: 13,
    marginBottom: 29,
  },
  alphabetTitle: {
    fontFamily: type.medium,
    fontSize: 28,
    letterSpacing: -1,
    color: palette.ink,
  },
  chart: { height: 250, width: "100%" },
});
