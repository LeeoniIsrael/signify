import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Animated,
  ImageBackground,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { useCameraPermissions } from "expo-camera";
import { Asset } from "expo-asset";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import {
  Pencil,
  Camera,
  Hand,
  Settings2,
  Square,
  Volume2,
  Maximize2,
  Delete,
  BookOpen,
} from "lucide-react-native";
import {
  SignifyCamera,
  hasNativeRecognition,
  type CameraPrediction,
  type CameraStatus,
} from "../../../modules/signify-camera";
import { StabilityGate } from "../../../../src/lib/recognition";
import { LetterConsensus } from "../../lib/live-recognition";
import { useSession } from "../../lib/session";
import { Action, type } from "../../components/ui";
import { HandAnalysis } from "../../components/HandAnalysis";

export default function Translate() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets(),
    focused = useIsFocused();
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
  const [active, setActive] = useState(false),
    [status, setStatus] = useState("off"),
    [error, setError] = useState("");
  const [models, setModels] = useState<{ cnn: string; hands: string } | null>(
    null,
  );
  const [letter, setLetter] = useState<string | null>(null),
    [progress, setProgress] = useState(0);
  const [frame, setFrame] = useState<CameraPrediction | null>(null);
  const [engineMessage, setEngineMessage] = useState("Getting ready…");
  const generation = useRef(0),
    alive = useRef(false);
  const gate = useRef(
    new StabilityGate({
      holdMs: 550,
      releaseMs: 300,
      minSamples: 3,
      maxGapMs: 1000,
    }),
  );
  const consensus = useRef(new LetterConsensus());
  const stale = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pulse] = useState(() => new Animated.Value(0));
  const [fill] = useState(() => new Animated.Value(0));
  const stop = useCallback(() => {
    generation.current++;
    alive.current = false;
    clearTimeout(stale.current);
    setActive(false);
    setStatus("off");
    setFrame(null);
    setLetter(null);
    setProgress(0);
    gate.current.reset();
    consensus.current.reset();
    fill.setValue(0);
  }, [fill]);
  useFocusEffect(useCallback(() => () => stop(), [stop]));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background" || (next !== "active" && alive.current)) stop();
    });
    return () => sub.remove();
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
    clearTimeout(stale.current);
    setFrame(prediction);
    const usable =
      prediction.hasHand &&
      (!prediction.quality || prediction.quality === "good");
    const result = consensus.current.update(prediction.logits, usable);
    setLetter(usable ? result.letter : null);
    const settled = gate.current.update(
      result.stable,
      performance.now(),
      prediction.hasHand,
    );
    setProgress(settled.progress);
    Animated.timing(fill, {
      toValue: settled.progress,
      duration: reducedMotion ? 0 : 90,
      useNativeDriver: true,
    }).start();
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
    stale.current = setTimeout(() => {
      setFrame(null);
      setLetter(null);
      setProgress(0);
      fill.setValue(0);
      consensus.current.reset();
      gate.current.update(null, performance.now(), true);
    }, 900);
  };
  const cameraStatus = (value: CameraStatus) => {
    if (value.state === "error") {
      setModels(null);
      stop();
      setError(value.message || "Camera unavailable. Try again.");
    } else if (alive.current) {
      setStatus(value.state);
      if (value.message) setEngineMessage(value.message);
    }
  };
  const live = active && focused;
  const hasHand = !!frame?.hasHand;
  const guidance =
    status === "loading"
      ? engineMessage
      : !hasHand
        ? "Bring one hand into view."
        : frame?.quality === "clipped"
          ? "Keep your whole hand in the frame."
          : frame?.quality === "too-small"
            ? "Move your hand a little closer."
            : frame?.quality === "moving"
              ? "Hold your sign steady."
              : progress === 1
                ? "Added. Make the next sign."
                : letter
                  ? `Hold ${letter} to add it.`
                  : "Hand found. Hold an ASL letter.";
  const open = (
    route: "/guide" | "/settings" | "/conversation" | "/present",
  ) => {
    stop();
    router.push(route);
  };
  return (
    <View style={s.page}>
      {focused && <StatusBar style="light" />}
      <ImageBackground
        source={require("../../../assets/hand-study.png")}
        style={StyleSheet.absoluteFill}
        imageStyle={{ opacity: live ? 0 : 0.8 }}
        resizeMode="cover"
      />
      {models && focused && (
        <SignifyCamera
          style={StyleSheet.absoluteFill}
          active={live}
          modelPath={models.cnn}
          handModelPath={models.hands}
          onPrediction={(event) => predict(event.nativeEvent)}
          onStatus={(event) => cameraStatus(event.nativeEvent)}
        />
      )}
      <LinearGradient
        colors={["#14221CB0", "transparent", "#14221CDA"]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <HandAnalysis
        frame={live ? frame : null}
        width={width}
        height={height}
        reducedMotion={reducedMotion}
      />
      <View style={[s.header, { top: insets.top + 12 }]}>
        <View style={s.brand}>
          <Hand size={20} color="#EDF4E9" />
          <Text style={s.logo}>signify.</Text>
        </View>
        <View style={s.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ASL alphabet and signing tips"
            onPress={() => open("/guide")}
            style={s.icon}
          >
            <BookOpen size={19} color="white" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Preferences"
            onPress={() => open("/settings")}
            style={s.icon}
          >
            <Settings2 size={19} color="white" />
          </Pressable>
        </View>
      </View>
      {!live && !error && (
        <View
          style={[s.welcome, { top: height * (height < 740 ? 0.23 : 0.3) }]}
        >
          <Text style={s.eyebrow}>Sign to text</Text>
          <Text
            accessibilityRole="header"
            style={[s.title, height < 740 && { fontSize: 38, lineHeight: 43 }]}
            maxFontSizeMultiplier={1.2}
          >
            Your hands,{"\n"}into words.
          </Text>
          <Text style={s.description}>
            Hold an ASL letter. Build a message.{"\n"}Speak it, or let someone
            read it.
          </Text>
        </View>
      )}
      {live && (
        <View style={[s.liveLabel, { top: insets.top + 76 }]}>
          <View
            style={[
              s.dot,
              { backgroundColor: hasHand ? "#CAE5BC" : "#EDF3E7" },
            ]}
          />
          <Text style={s.liveText}>
            {status === "loading"
              ? "Getting ready"
              : hasHand
                ? "Hand tracked"
                : "Looking for your hand"}
          </Text>
        </View>
      )}
      {live && letter && (
        <BlurView
          intensity={35}
          tint="dark"
          style={[s.letterBubble, { top: height * 0.34 }]}
        >
          <Text style={s.letter}>{letter}</Text>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Letter capture progress"
            accessibilityValue={{
              min: 0,
              max: 100,
              now: Math.round(progress * 100),
            }}
            style={s.track}
          >
            <Animated.View
              style={[s.fill, { transform: [{ scaleX: fill }] }]}
            />
          </View>
          <Text style={s.letterCaption}>
            {progress === 1 ? "Added ✓" : "Hold steady"}
          </Text>
        </BlurView>
      )}
      <View style={[s.bottom, { bottom: Math.max(insets.bottom, 16) + 80 }]}>
        {error ? (
          <View style={s.error}>
            <Text accessibilityLiveRegion="polite" style={s.description}>
              {error}
            </Text>
            {permission && !permission.canAskAgain && !permission.granted && (
              <Action
                title="Allow camera in Settings"
                onPress={() => void Linking.openSettings()}
                secondary
              />
            )}
          </View>
        ) : live ? (
          <Text accessibilityLiveRegion="polite" style={s.guidance}>
            {guidance}
          </Text>
        ) : null}
        <BlurView
          intensity={55}
          tint="dark"
          style={[
            s.composer,
            preferences.highContrast && { borderColor: "white" },
          ]}
        >
          <View style={s.messageHeader}>
            <Text style={s.eyebrow}>Your message</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit message"
              style={s.edit}
              onPress={() => open("/conversation")}
            >
              <Pencil size={17} color="white" />
              <Text style={s.controlText}>Edit</Text>
            </Pressable>
          </View>
          <Text
            accessibilityLiveRegion="polite"
            numberOfLines={2}
            style={[s.message, preferences.largeText && { fontSize: 25 }]}
          >
            {message || "Your signed letters appear here."}
          </Text>
          <View style={s.controls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a space"
              disabled={!message}
              onPress={() => {
                setMessage((old) => (old + " ").slice(0, 1000));
                feedback();
              }}
              style={s.control}
            >
              <Text style={[s.controlText, !message && s.disabled]}>Space</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete last letter"
              disabled={!message}
              onPress={() => {
                setMessage((old) => old.slice(0, -1));
                feedback();
              }}
              style={s.control}
            >
              <Delete size={17} color={!message ? "#FFFFFF66" : "white"} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show message full screen"
              disabled={!message.trim()}
              onPress={() => open("/present")}
              style={s.control}
            >
              <Maximize2
                size={16}
                color={!message.trim() ? "#FFFFFF66" : "white"}
              />
              <Text style={[s.controlText, !message.trim() && s.disabled]}>
                Show
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={speaking ? "Stop speaking" : "Speak message"}
              disabled={!message.trim()}
              onPress={speak}
              style={s.control}
            >
              <Volume2
                size={17}
                color={!message.trim() ? "#FFFFFF66" : "white"}
              />
              <Text style={[s.controlText, !message.trim() && s.disabled]}>
                {speaking ? "Stop" : "Speak"}
              </Text>
            </Pressable>
          </View>
          <Action
            testID="camera-toggle"
            title={
              active
                ? "Pause camera"
                : status === "loading"
                  ? "Cancel"
                  : "Start translating"
            }
            onPress={active || status === "loading" ? stop : start}
            icon={
              active ? (
                <Square size={15} color="white" />
              ) : (
                <Camera size={18} color="white" />
              )
            }
            style={s.cameraButton}
          />
        </BlurView>
        {!live && (
          <Text style={s.scope}>
            24 static ASL letters · type J and Z · review before sharing
          </Text>
        )}
      </View>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, s.confirmation, { opacity: pulse }]}
      />
    </View>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#16241C" },
  header: {
    position: "absolute",
    left: 23,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: {
    fontFamily: type.semi,
    fontSize: 26,
    letterSpacing: -1.4,
    color: "#F3F6EF",
  },
  headerActions: { flexDirection: "row", gap: 8 },
  icon: {
    height: 44,
    width: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#20332955",
    borderWidth: 1,
    borderColor: "#FFFFFF35",
  },
  welcome: { position: "absolute", left: 28, right: 24, gap: 13 },
  eyebrow: { fontFamily: type.medium, fontSize: 12, color: "#E6EEDC" },
  title: {
    fontFamily: type.regular,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -2.4,
    color: "white",
  },
  description: {
    fontFamily: type.regular,
    fontSize: 14,
    lineHeight: 23,
    color: "#EDF2E9",
  },
  liveLabel: {
    position: "absolute",
    left: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#20312999",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontFamily: type.medium, fontSize: 11, color: "#EEF4E9" },
  letterBubble: {
    position: "absolute",
    right: 22,
    borderRadius: 27,
    padding: 17,
    minWidth: 100,
    overflow: "hidden",
    alignItems: "center",
    gap: 9,
    backgroundColor: "#C5D4C020",
    borderWidth: 1,
    borderColor: "#FFFFFF55",
  },
  letter: {
    fontFamily: type.regular,
    fontSize: 61,
    lineHeight: 70,
    color: "white",
  },
  letterCaption: { fontFamily: type.medium, fontSize: 10, color: "#EDF3E7" },
  track: {
    width: 66,
    height: 3,
    backgroundColor: "#FFFFFF30",
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    width: 66,
    height: 3,
    backgroundColor: "#C9E4BD",
    transformOrigin: "left center",
  },
  bottom: { position: "absolute", left: 18, right: 18, gap: 10 },
  guidance: {
    fontFamily: type.medium,
    fontSize: 13,
    lineHeight: 20,
    color: "white",
    textAlign: "center",
    backgroundColor: "#20332990",
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  composer: {
    borderRadius: 26,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "#20322966",
    borderColor: "#FFFFFF50",
    borderWidth: 1,
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  edit: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 13,
  },
  message: {
    fontFamily: type.medium,
    fontSize: 20,
    lineHeight: 27,
    letterSpacing: -0.5,
    color: "white",
    paddingBottom: 7,
  },
  controls: { flexDirection: "row", alignItems: "center", gap: 2 },
  control: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  controlText: { fontFamily: type.medium, fontSize: 12, color: "white" },
  disabled: { opacity: 0.4 },
  cameraButton: { minHeight: 46, backgroundColor: "#56725E", marginTop: 3 },
  scope: {
    fontFamily: type.regular,
    fontSize: 10,
    lineHeight: 15,
    color: "#D9E4D4",
    textAlign: "center",
  },
  error: {
    backgroundColor: "#203329DA",
    borderRadius: 21,
    padding: 16,
    gap: 10,
  },
  confirmation: { borderWidth: 3, borderColor: "#D5E9C9" },
});
