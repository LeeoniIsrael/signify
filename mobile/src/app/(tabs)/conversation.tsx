import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  Copy,
  Expand,
  MessageCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  Square,
  Volume2,
} from "lucide-react-native";
import { useSession } from "../../lib/session";
import { Action, Label, palette, type } from "../../components/ui";
export default function Conversation() {
  const {
    message,
    setMessage,
    reply,
    setReply,
    preferences,
    speak,
    speaking,
    savePhrase,
    clearMessage,
    notify,
  } = useSession();
  return (
    <SafeAreaView edges={["top"]} style={s.page}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={s.content}
        >
          <View style={s.labelRow}>
            <MessageCircle size={18} color={palette.muted} />
            <Label>Your conversation</Label>
            <View style={s.badge}>
              <Label>This visit</Label>
            </View>
          </View>
          <Text accessibilityRole="header" style={s.title}>
            Let’s make ourselves{"\n"}understood.
          </Text>
          <Text style={s.subtitle}>
            A thought. A question. A little connection.
          </Text>
          <View
            style={[
              s.composer,
              preferences.highContrast && { borderColor: palette.ink },
            ]}
          >
            <View style={s.row}>
              <Label>Your message</Label>
              <Label>Editable, always</Label>
            </View>
            <TextInput
              testID="message-input"
              accessibilityLabel="Your message"
              multiline
              maxLength={1000}
              value={message}
              onChangeText={setMessage}
              placeholder="Every conversation starts with a hello…"
              placeholderTextColor="#6D7C66"
              style={[
                s.input,
                preferences.largeText && { fontSize: 30, lineHeight: 40 },
              ]}
              textAlignVertical="top"
            />
            <View style={s.composerBottom}>
              <Label>Check your words before sharing.</Label>
              <Label>{message.length}/1000</Label>
            </View>
          </View>
          <View style={s.actions}>
            <Action
              title={speaking ? "Stop speaking" : "Speak message"}
              onPress={speak}
              disabled={!message.trim()}
              icon={
                speaking ? (
                  <Square size={17} color="white" />
                ) : (
                  <Volume2 size={18} color="white" />
                )
              }
              style={{ flex: 1 }}
            />
            <Action
              title="Show"
              secondary
              disabled={!message.trim()}
              onPress={() => router.push("/present")}
              icon={<Expand size={17} color={palette.ink} />}
            />
          </View>
          <View style={s.minor}>
            <Pressable
              accessibilityRole="button"
              disabled={!message.trim()}
              onPress={() =>
                void Clipboard.setStringAsync(message)
                  .then(() => notify("Message copied."))
                  .catch(() => notify("Copy is unavailable."))
              }
              style={s.minorButton}
            >
              <Copy size={14} color={palette.muted} />
              <Label>Copy</Label>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!message.trim()}
              onPress={() => savePhrase(message)}
              style={s.minorButton}
            >
              <Plus size={15} color={palette.muted} />
              <Label>Save phrase</Label>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!message}
              onPress={clearMessage}
              style={s.minorButton}
            >
              <RotateCcw size={14} color={palette.muted} />
              <Label>Clear</Label>
            </Pressable>
          </View>
          <View style={s.reply}>
            <Text style={s.replyTitle}>Their side of the conversation.</Text>
            <Label>
              Pass the phone. They can type or use keyboard dictation.
            </Label>
            <TextInput
              testID="reply-input"
              accessibilityLabel="Their reply"
              value={reply}
              onChangeText={setReply}
              multiline
              maxLength={2000}
              placeholder="There’s space for your words here…"
              placeholderTextColor={palette.muted}
              style={[
                s.replyInput,
                preferences.largeText && { fontSize: 24, lineHeight: 33 },
              ]}
              textAlignVertical="top"
            />
          </View>
          <View style={s.privacy}>
            <ShieldCheck size={15} color={palette.muted} />
            <Text style={s.privacyText}>
              Conversations stay in memory for this visit.{"\n"}Only phrases you
              save stay on this phone.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, paddingBottom: 125 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  badge: {
    marginLeft: "auto",
    backgroundColor: palette.soft,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  title: {
    fontFamily: type.medium,
    fontSize: 33,
    lineHeight: 42,
    letterSpacing: -1.6,
    color: palette.ink,
    marginTop: 28,
  },
  subtitle: {
    fontFamily: type.regular,
    fontSize: 12,
    lineHeight: 20,
    color: palette.muted,
    marginTop: 10,
    marginBottom: 27,
  },
  composer: {
    backgroundColor: palette.paper,
    borderRadius: 24,
    padding: 19,
    borderWidth: 1,
    borderColor: "#D6E0D0",
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  input: {
    minHeight: 165,
    fontFamily: type.medium,
    fontSize: 25,
    lineHeight: 35,
    letterSpacing: -0.7,
    color: palette.ink,
    paddingTop: 20,
    paddingBottom: 15,
  },
  composerBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: palette.line,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  minor: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 6,
    marginBottom: 23,
  },
  minorButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 45,
    paddingHorizontal: 5,
  },
  reply: { backgroundColor: "#E3EAE0", borderRadius: 24, padding: 20, gap: 9 },
  replyTitle: {
    fontFamily: type.semi,
    fontSize: 17,
    letterSpacing: -0.5,
    color: palette.ink,
  },
  replyInput: {
    minHeight: 126,
    fontFamily: type.regular,
    fontSize: 18,
    lineHeight: 27,
    color: palette.ink,
    paddingTop: 12,
  },
  privacy: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 22,
  },
  privacyText: {
    fontFamily: type.regular,
    fontSize: 10,
    lineHeight: 17,
    color: palette.muted,
  },
});
