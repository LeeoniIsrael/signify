import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";

type Preferences = {
  haptics: boolean;
  largeText: boolean;
  highContrast: boolean;
};
type Toast = { text: string; undo?: () => void } | null;
const initialPreferences: Preferences = {
  haptics: true,
  largeText: false,
  highContrast: false,
};
export function useSessionState() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saved, setSaved] = useState<string[]>([]);
  const [toast, setToast] = useState<Toast>(null);
  const [speaking, setSpeaking] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const ready = useRef(false);
  const notify = useCallback((text: string, undo?: () => void) => {
    setToast({ text, undo });
    AccessibilityInfo.announceForAccessibility(text);
  }, []);
  useEffect(() => {
    let mounted = true;
    AsyncStorage.multiGet(["signify:preferences", "signify:phrases"])
      .then((values) => {
        if (!mounted) return;
        try {
          const settings = JSON.parse(values[0][1] || "{}");
          setPreferences({
            haptics:
              typeof settings.haptics === "boolean" ? settings.haptics : true,
            largeText: settings.largeText === true,
            highContrast: settings.highContrast === true,
          });
          const phrases: unknown = JSON.parse(values[1][1] || "[]");
          if (Array.isArray(phrases))
            setSaved(
              phrases
                .filter((v): v is string => typeof v === "string")
                .map((p) => p.slice(0, 300))
                .slice(0, 30),
            );
        } catch {
          notify(
            "Saved settings could not be read. This session is ready to use.",
          );
        }
        ready.current = true;
      })
      .catch(() => {
        ready.current = true;
        notify("Device storage is unavailable. Your conversation still works.");
      });
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    const app = AppState.addEventListener("change", (next) => {
      if (next !== "active") {
        void Speech.stop();
        setSpeaking(false);
      }
    });
    return () => {
      mounted = false;
      motion.remove();
      app.remove();
      void Speech.stop();
    };
  }, [notify]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(id);
  }, [toast]);
  const feedback = useCallback(
    (kind: "selection" | "success" = "selection") => {
      if (!preferences.haptics) return;
      const operation =
        Platform.OS === "android"
          ? Haptics.performAndroidHapticsAsync(
              kind === "success"
                ? Haptics.AndroidHaptics.Confirm
                : Haptics.AndroidHaptics.Clock_Tick,
            )
          : kind === "success"
            ? Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              )
            : Haptics.selectionAsync();
      void operation.catch(() => {}); // Visual confirmation remains available when hardware suppresses haptics.
    },
    [preferences.haptics],
  );
  const updatePreference = (key: keyof Preferences, value: boolean) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    if (ready.current)
      void AsyncStorage.setItem(
        "signify:preferences",
        JSON.stringify(next),
      ).catch(() =>
        notify("Preference changed for this visit. Storage is unavailable."),
      );
  };
  const speak = () => {
    if (speaking) {
      void Speech.stop();
      setSpeaking(false);
      return;
    }
    if (!message.trim()) return;
    feedback();
    setSpeaking(true);
    Speech.speak(message, {
      language: "en-US",
      rate: 0.85,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => {
        setSpeaking(false);
        notify("Speech is unavailable. Show your message instead.");
      },
    });
  };
  const replaceMessage = (text: string) => {
    const old = message;
    setMessage(text.slice(0, 1000));
    feedback();
    if (old) notify("Message updated.", () => setMessage(old));
  };
  const clearMessage = () => {
    const old = message;
    setMessage("");
    if (old) notify("Message cleared.", () => setMessage(old));
  };
  const savePhrase = (phrase: string) => {
    const text = phrase.trim();
    if (!text) return;
    if (text.length > 300) {
      notify("Saved phrases can contain up to 300 characters.");
      return;
    }
    if (saved.includes(text)) {
      notify("That phrase is already saved.");
      return;
    }
    if (saved.length >= 30) {
      notify("Remove a saved phrase before adding another.");
      return;
    }
    const next = [...saved, text];
    setSaved(next);
    feedback("success");
    void AsyncStorage.setItem("signify:phrases", JSON.stringify(next))
      .then(() => notify("Phrase saved on this phone."))
      .catch(() =>
        notify("Saved for this visit. Device storage is unavailable."),
      );
  };
  const removePhrase = (phrase: string) => {
    const next = saved.filter((p) => p !== phrase);
    setSaved(next);
    void AsyncStorage.setItem("signify:phrases", JSON.stringify(next)).catch(
      () => notify("The phrase may return next time. Storage is unavailable."),
    );
  };
  return {
    message,
    setMessage,
    reply,
    setReply,
    preferences,
    updatePreference,
    saved,
    savePhrase,
    removePhrase,
    toast,
    setToast,
    notify,
    feedback,
    speak,
    speaking,
    replaceMessage,
    clearMessage,
    reducedMotion,
  };
}
