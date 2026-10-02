import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Animated,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { useCameraPermissions } from "expo-camera";
import { Asset } from "expo-asset";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  Pencil,
  Camera,
  Hand,
  Info,
  Settings2,
  ShieldCheck,
  Square,
  Volume2,
  Maximize2,
} from "lucide-react-native";
import {
  SignifyCamera,
  hasNativeRecognition,
  type CameraPrediction,
  type CameraStatus,
} from "../../../modules/signify-camera";
import { classify, StabilityGate } from "../../../../src/lib/recognition";
import { useSession } from "../../lib/session";
import {
  Action,
  Brand,
  IconButton,
  Label,
  palette,
  type,
} from "../../components/ui";

export default function Translate() {
  const { height } = useWindowDimensions();
  const focused = useIsFocused();
  const {
    message,
    setMessage,
    feedback,
    speak,
    speaking,
    preferences,
    reducedMotion,
  } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("off");
  const [error, setError] = useState("");
  const [models, setModels] = useState<{ cnn: string; hands: string } | null>(
    null,
  );
  const [letter, setLetter] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [hasHand, setHasHand] = useState(false);
  const [engineMessage, setEngineMessage] = useState("Loading recognition…");
  const generation = useRef(0);
  const gate = useRef(new StabilityGate());
  const alive = useRef(false);
  const [pulse] = useState(() => new Animated.Value(0));
  const stop = useCallback(() => {
    generation.current++;
    alive.current = false;
    setActive(false);
    setHasHand(false);
    setStatus("off");
    setLetter(null);
    setProgress(0);
    gate.current.reset();
  }, []);
  useFocusEffect(useCallback(() => () => stop(), [stop]));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") stop();
    });
    return () => subscription.remove();
  }, [stop]);
  const start = async () => {
    stop();
    setError("");
    setStatus("loading");
    setEngineMessage("Getting your camera ready…");
    feedback();
    const run = generation.current;
    try {
      const granted = permission?.granted
        ? permission
        : await requestPermission();
      if (run !== generation.current) return;
      if (!granted.granted) {
        setStatus("off");
        setError(
          granted.canAskAgain
            ? "Camera access is needed for fingerspelling. You can still type a message."
            : "Camera access is off. Open Settings to allow it, or type a message.",
        );
        return;
      }
      if (!hasNativeRecognition) {
        setModels({ cnn: "expo-go-recognition", hands: "" });
        alive.current = true;
        setActive(true);
        return;
      }
      const [cnn, hands] = await Promise.all([
        Asset.fromModule(
          // Metro requires a static asset reference.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("../../../assets/signlanguage.onnx"),
        ).downloadAsync(),
        Asset.fromModule(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("../../../assets/hand_landmarker.task"),
        ).downloadAsync(),
      ]);
      if (run !== generation.current) return;
      if (!cnn.localUri || !hands.localUri)
        throw new Error("Models unavailable");
      setModels({ cnn: cnn.localUri, hands: hands.localUri });
      alive.current = true;
      setActive(true);
    } catch {
      if (run === generation.current) {
        stop();
        setError(
          "The camera could not get ready. Try again or type your message.",
        );
      }
    }
  };
  const predict = (prediction: CameraPrediction) => {
    if (!alive.current || !focused) return;
    const result = classify(prediction.logits);
    setLetter(result.letter);
    setHasHand(prediction.hasHand);
    const settled = gate.current.update(
      result.letter,
      performance.now(),
      prediction.hasHand,
    );
    setProgress(settled.progress);
    if (settled.committed) {
      setMessage((old) => (old + settled.committed).slice(0, 1000));
      feedback("success");
      pulse.setValue(1);
      Animated.timing(pulse, {
        toValue: 0,
        duration: reducedMotion ? 0 : 450,
        useNativeDriver: true,
      }).start();
    }
  };
  const cameraStatus = (value: CameraStatus) => {
    if (!alive.current) return;
    if (value.state === "error") {
      stop();
      setError(value.message || "The camera is unavailable.");
    } else {
      setStatus(value.state);
      if (value.message) setEngineMessage(value.message);
    }
  };
  const live = active && focused;
  return (
    <SafeAreaView style={s.page} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <Brand />
          <IconButton
            label="Preferences"
            onPress={() => {
              stop();
              router.push("/settings");
            }}
          >
            <Settings2 size={19} color={palette.ink} />
          </IconButton>
        </View>
        <View style={s.intro}>
          <Label>Your hands. Your words.</Label>
          <Text accessibilityRole="header" style={s.title}>
            Sign to text.
          </Text>
          <Text style={s.subtitle}>
            Spell a message with ASL. Speak it or show it.
          </Text>
        </View>
        <View style={[s.camera, { minHeight: height < 740 ? 285 : 335 }]}>
          <ImageBackground
            source={require("../../../assets/hand-study.png")}
            style={StyleSheet.absoluteFill}
            imageStyle={{ opacity: live ? 0 : 1 }}
            resizeMode="cover"
          />
          {live && models && (
            <SignifyCamera
              key={models.cnn}
              style={StyleSheet.absoluteFill}
              active={live}
              modelPath={models.cnn}
              handModelPath={models.hands}
              onPrediction={(e) => predict(e.nativeEvent)}
              onStatus={(e) => cameraStatus(e.nativeEvent)}
            />
          )}
          <LinearGradient
            colors={["#172B2110", "transparent", "#172B21C0"]}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={s.cameraTop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="About ASL fingerspelling"
              onPress={() => {
                stop();
                router.push("/guide");
              }}
              style={s.glassPill}
            >
              <Hand size={13} color="white" />
              <Text style={s.pillText}>ASL fingerspelling</Text>
            </Pressable>
            <View style={[s.glassPill, { backgroundColor: "#22332BCD" }]}>
              <View
                style={[
                  s.dot,
                  { backgroundColor: live ? "#B1D9AD" : "#DCE6DA" },
                ]}
              />
              <Text style={s.pillText}>
                {status === "loading"
                  ? "Getting ready"
                  : live
                    ? "Recognizing"
                    : "Camera off"}
              </Text>
            </View>
          </View>
          <View pointerEvents="none" style={s.frame}>
            <View style={[s.corner, s.topLeft]} />
            <View style={[s.corner, s.topRight]} />
            <View style={[s.corner, s.bottomLeft]} />
            <View style={[s.corner, s.bottomRight]} />
          </View>
          {live && status !== "loading" && (
            <BlurView intensity={45} tint="light" style={s.letterBubble}>
              <Text style={s.letterLabel}>Suggested letter</Text>
              <Text style={s.letter}>{letter || "—"}</Text>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Letter hold progress"
                accessibilityValue={{
                  min: 0,
                  max: 100,
                  now: Math.round(progress * 100),
                }}
                style={s.progress}
              >
                <View
                  style={{
                    width: `${progress * 100}%`,
                    height: 3,
                    backgroundColor: palette.sage,
                  }}
                />
              </View>
              <Text style={s.letterLabel}>
                {progress === 1 ? "Added ✓" : "Hold to add"}
              </Text>
            </BlurView>
          )}
          <View style={s.cameraBottom}>
            {error ? (
              <View style={s.error}>
                <Text style={s.errorText}>{error}</Text>
                {permission &&
                  !permission.canAskAgain &&
                  !permission.granted && (
                    <Action
                      title="Open Settings"
                      secondary
                      onPress={() => void Linking.openSettings()}
                    />
                  )}
              </View>
            ) : !live && status === "off" ? (
              <View style={s.welcome}>
                <Text style={s.welcomeTitle}>
                  Make a sign.{"\n"}Make a connection.
                </Text>
                <Text style={s.welcomeDetail}>
                  Start the camera. Hold one ASL letter until it’s added to your
                  message.
                </Text>
              </View>
            ) : (
              <Text accessibilityLiveRegion="polite" style={s.guidance}>
                {status === "loading"
                  ? engineMessage
                  : !hasHand
                    ? "Bring one hand into the frame, with your palm facing the camera."
                    : letter
                      ? progress === 1
                        ? "Letter added. Make the next sign, or lower your hand to repeat."
                        : `Hold ${letter} steady until the bar fills.`
                      : "Hand found. Use an ASL letter and hold it steady in even light."}
              </Text>
            )}
            <BlurView intensity={45} tint="light" style={s.dock}>
              <View style={s.private}>
                <ShieldCheck size={15} color="white" />
                <Text style={s.privateText}>Only on{"\n"}your device</Text>
              </View>
              <Action
                testID="camera-toggle"
                title={
                  active
                    ? "Stop translating"
                    : status === "loading"
                      ? "Cancel"
                      : "Start translating"
                }
                icon={
                  active ? (
                    <Square size={16} color="white" />
                  ) : (
                    <Camera size={17} color="white" />
                  )
                }
                onPress={active || status === "loading" ? stop : start}
                style={{ minHeight: 49, paddingHorizontal: 18 }}
              />
            </BlurView>
          </View>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              s.captureFlash,
              { opacity: pulse },
            ]}
          />
        </View>
        <View
          style={[
            s.messageCard,
            preferences.highContrast && { borderColor: palette.ink },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Label>Your message</Label>
            <Text
              numberOfLines={2}
              accessibilityLiveRegion="polite"
              style={[s.message, preferences.largeText && { fontSize: 25 }]}
            >
              {message || "Your signed letters will appear here."}
            </Text>
          </View>
          <IconButton
            label="Edit message"
            onPress={() => {
              stop();
              router.push("/conversation");
            }}
          >
            <Pencil size={20} color={palette.ink} />
          </IconButton>
        </View>
        <View style={s.quickControls}>
          <Pressable
            accessibilityRole="button"
            disabled={!message}
            onPress={() => setMessage((old) => (old + " ").slice(0, 1000))}
            style={s.smallControl}
          >
            <Text style={[s.controlText, !message && { opacity: 0.45 }]}>
              Space ␣
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!message}
            onPress={() => setMessage((old) => old.slice(0, -1))}
            style={s.smallControl}
          >
            <Text style={[s.controlText, !message && { opacity: 0.45 }]}>
              Delete
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show message full screen"
            disabled={!message.trim()}
            onPress={() => {
              stop();
              router.push("/present");
            }}
            style={s.smallControl}
          >
            <Maximize2
              size={16}
              color={!message.trim() ? palette.muted : palette.ink}
            />
            <Text style={[s.controlText, !message.trim() && { opacity: 0.45 }]}>
              Show
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={speaking ? "Stop speaking" : "Speak message"}
            disabled={!message.trim()}
            onPress={speak}
            style={[
              s.smallControl,
              { marginLeft: "auto", flexDirection: "row", gap: 6 },
            ]}
          >
            <Volume2 size={15} color={palette.ink} />
            <Text style={[s.controlText, !message && { opacity: 0.45 }]}>
              {speaking ? "Stop" : "Speak"}
            </Text>
          </Pressable>
        </View>
        <View style={s.scope}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              stop();
              router.push("/guide");
            }}
            style={s.scopeLink}
          >
            <Info size={12} color={palette.muted} />
            <Text style={s.scopeText}>
              ASL letters A–Y, except J. Type J & Z. Review before sharing.
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 109,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 9,
    paddingBottom: 20,
  },
  intro: { gap: 5, paddingBottom: 22 },
  subtitle: {
    fontFamily: type.regular,
    fontSize: 13,
    lineHeight: 20,
    color: palette.muted,
  },
  title: {
    fontFamily: type.medium,
    fontSize: 32,
    letterSpacing: -1.8,
    lineHeight: 41,
    color: palette.ink,
  },
  camera: {
    flex: 1,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#A7AEA8",
  },
  cameraTop: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 17,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  glassPill: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#34453BDD",
    borderWidth: 1,
    borderColor: "#FFFFFF35",
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pillText: { color: "white", fontFamily: type.medium, fontSize: 10 },
  dot: { width: 5, height: 5, borderRadius: 5 },
  frame: {
    position: "absolute",
    top: "22%",
    left: "22%",
    right: "22%",
    bottom: "28%",
  },
  corner: {
    position: "absolute",
    width: 20,
    height: 20,
    borderColor: "#FFFFFF9B",
  },
  topLeft: {
    left: 0,
    top: 0,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderTopLeftRadius: 11,
  },
  topRight: {
    right: 0,
    top: 0,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderTopRightRadius: 11,
  },
  bottomLeft: {
    left: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderBottomLeftRadius: 11,
  },
  bottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderBottomRightRadius: 11,
  },
  cameraBottom: {
    position: "absolute",
    left: 13,
    right: 13,
    bottom: 13,
    gap: 18,
  },
  welcome: { paddingHorizontal: 9, gap: 10 },
  welcomeTitle: {
    fontFamily: type.regular,
    fontSize: 31,
    letterSpacing: -1.8,
    lineHeight: 35,
    color: "white",
  },
  welcomeDetail: {
    fontFamily: type.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "#EDF3E7",
  },
  dock: {
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: "#FFFFFF55",
    overflow: "hidden",
    backgroundColor: "#FFFFFF27",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  private: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 7,
  },
  privateText: {
    fontFamily: type.medium,
    fontSize: 9,
    color: "white",
    lineHeight: 14,
  },
  letterBubble: {
    position: "absolute",
    right: 16,
    top: 72,
    borderRadius: 22,
    padding: 14,
    minWidth: 109,
    overflow: "hidden",
    backgroundColor: "#EDF0EAD0",
    borderWidth: 1,
    borderColor: "#FFFFFF88",
    alignItems: "center",
    gap: 5,
  },
  letterLabel: { fontFamily: type.medium, fontSize: 9, color: palette.ink },
  letter: {
    fontFamily: type.regular,
    fontSize: 53,
    lineHeight: 65,
    color: palette.ink,
  },
  progress: {
    width: 75,
    height: 3,
    backgroundColor: "#546B4430",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  guidance: {
    fontFamily: type.medium,
    fontSize: 13,
    lineHeight: 20,
    color: "white",
    backgroundColor: "#203129D9",
    padding: 13,
    borderRadius: 14,
  },
  error: {
    backgroundColor: "#F0F4EBF2",
    padding: 16,
    gap: 12,
    borderRadius: 16,
  },
  errorText: {
    fontFamily: type.medium,
    fontSize: 12,
    lineHeight: 20,
    color: palette.ink,
  },
  captureFlash: { borderWidth: 4, borderColor: "#D4E9CA", borderRadius: 28 },
  messageCard: {
    marginTop: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 87,
  },
  message: {
    fontFamily: type.medium,
    fontSize: 17,
    letterSpacing: -0.4,
    lineHeight: 23,
    color: palette.ink,
    marginTop: 3,
  },
  quickControls: { flexDirection: "row", gap: 3, paddingTop: 2 },
  smallControl: {
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 44,
  },
  controlText: { fontFamily: type.medium, fontSize: 11, color: palette.ink },
  scope: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 3,
  },
  scopeLink: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 30,
  },
  scopeText: { fontFamily: type.regular, fontSize: 10, color: palette.muted },
  demo: { paddingLeft: 10, minHeight: 30, justifyContent: "center" },
  demoText: { fontFamily: type.semi, fontSize: 10, color: palette.muted },
});
