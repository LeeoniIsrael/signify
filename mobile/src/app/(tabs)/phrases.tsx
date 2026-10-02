import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowUpRight, BookOpen, Plus, X } from "lucide-react-native";
import { useSession } from "../../lib/session";
import { phrasebook } from "../../lib/phrases";
import { Action, IconButton, Label, palette, type } from "../../components/ui";
export default function Phrases() {
  const [category, setCategory] = useState<keyof typeof phrasebook>("Everyday");
  const [draft, setDraft] = useState("");
  const { saved, savePhrase, removePhrase, replaceMessage, feedback } =
    useSession();
  const selectPhrase = (phrase: string) => {
    replaceMessage(phrase);
    router.navigate("/conversation");
  };
  return (
    <SafeAreaView edges={["top"]} style={s.page}>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={s.label}>
          <BookOpen size={17} color={palette.muted} />
          <Label>Ready for real life.</Label>
        </View>
        <Text accessibilityRole="header" style={s.title}>
          The right words,{"\n"}ready.
        </Text>
        <Text style={s.subtitle}>
          Small moments deserve easy conversations.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.categories}
        >
          {(Object.keys(phrasebook) as (keyof typeof phrasebook)[]).map(
            (item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: category === item }}
                onPress={() => {
                  setCategory(item);
                  feedback();
                }}
                style={[
                  s.category,
                  category === item && {
                    backgroundColor: palette.ink,
                    borderColor: palette.ink,
                  },
                ]}
              >
                <Text
                  style={[
                    s.categoryText,
                    category === item && { color: "white" },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ),
          )}
        </ScrollView>
        <View style={{ gap: 12 }}>
          {phrasebook[category].map((phrase, i) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Use phrase: ${phrase}`}
              key={phrase}
              onPress={() => selectPhrase(phrase)}
              style={({ pressed }) => [
                s.phrase,
                i % 2 === 1 && { backgroundColor: "#E0E8DC" },
                pressed && { transform: [{ scale: 0.985 }] },
              ]}
            >
              <Text style={s.phraseText}>{phrase}</Text>
              <View style={s.phraseBottom}>
                <Label>Use this phrase</Label>
                <ArrowUpRight size={18} color={palette.muted} />
              </View>
            </Pressable>
          ))}
        </View>
        <Text accessibilityRole="header" style={s.savedTitle}>
          A little more you.
        </Text>
        <Label>Your saved phrases, only on this phone.</Label>
        <View style={s.form}>
          <TextInput
            accessibilityLabel="New personal phrase"
            value={draft}
            onChangeText={setDraft}
            placeholder="Something you say often…"
            placeholderTextColor={palette.muted}
            maxLength={300}
            style={s.draft}
          />
          <Action
            title="Save"
            icon={<Plus size={16} color="white" />}
            disabled={!draft.trim()}
            onPress={() => {
              savePhrase(draft);
              setDraft("");
            }}
            style={{ paddingHorizontal: 16 }}
          />
        </View>
        {saved.length === 0 ? (
          <Text style={s.empty}>
            Your coffee order. An introduction.{"\n"}Save a phrase and it’ll be
            here next time.
          </Text>
        ) : (
          saved.map((phrase) => (
            <View key={phrase} style={s.saved}>
              <Pressable
                accessibilityRole="button"
                onPress={() => selectPhrase(phrase)}
                style={{ flex: 1, padding: 16 }}
              >
                <Text style={s.savedText}>{phrase}</Text>
              </Pressable>
              <IconButton
                label={`Remove saved phrase: ${phrase}`}
                onPress={() => removePhrase(phrase)}
              >
                <X size={16} color={palette.muted} />
              </IconButton>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, paddingBottom: 125 },
  label: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  title: {
    fontFamily: type.medium,
    fontSize: 39,
    lineHeight: 45,
    letterSpacing: -1.8,
    color: palette.ink,
    marginTop: 25,
  },
  subtitle: {
    fontFamily: type.regular,
    fontSize: 12,
    color: palette.muted,
    marginTop: 12,
    lineHeight: 20,
  },
  categories: { gap: 8, paddingVertical: 25 },
  category: {
    borderWidth: 1,
    borderColor: "#CBD6C7",
    borderRadius: 25,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  categoryText: { fontFamily: type.medium, fontSize: 12, color: palette.ink },
  phrase: {
    minHeight: 146,
    backgroundColor: palette.paper,
    borderRadius: 24,
    padding: 23,
    justifyContent: "space-between",
    gap: 23,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  phraseText: {
    fontFamily: type.medium,
    fontSize: 23,
    lineHeight: 31,
    letterSpacing: -0.8,
    color: palette.ink,
  },
  phraseBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  savedTitle: {
    fontFamily: type.medium,
    fontSize: 29,
    letterSpacing: -1,
    color: palette.ink,
    marginTop: 37,
    marginBottom: 8,
  },
  form: { flexDirection: "row", gap: 8, marginVertical: 19 },
  draft: {
    flex: 1,
    minWidth: 0,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontFamily: type.regular,
    fontSize: 12,
    color: palette.ink,
  },
  empty: {
    fontFamily: type.regular,
    fontSize: 12,
    lineHeight: 21,
    color: palette.muted,
  },
  saved: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.paper,
    borderRadius: 16,
    marginBottom: 9,
    paddingRight: 8,
  },
  savedText: {
    fontFamily: type.medium,
    fontSize: 14,
    lineHeight: 22,
    color: palette.ink,
  },
});
