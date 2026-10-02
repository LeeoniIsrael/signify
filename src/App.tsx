import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Camera,
  CameraOff,
  Check,
  ChevronDown,
  Copy,
  Expand,
  Hand,
  Heart,
  Info,
  Keyboard,
  LoaderCircle,
  MessageCircle,
  Mic,
  Plus,
  RotateCcw,
  ScanLine,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Square,
  Volume2,
  X,
} from "lucide-react";
import type { FrameResult, SignEngine } from "./lib/engine";
import { LETTERS, StabilityGate } from "./lib/recognition";
import { readSetting, saveSetting } from "./lib/storage";

type Tab = "translate" | "phrases" | "guide";
type CameraState = "off" | "loading" | "live" | "demo" | "error";
type Modal = "settings" | "about" | "present" | "microphone" | null;
type SpeechInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        resultIndex: number;
        results: {
          length: number;
          [key: number]: { isFinal: boolean; 0: { transcript: string } };
        };
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechInstance;
  webkitSpeechRecognition?: new () => SpeechInstance;
};
const contexts = [
  "Everyday",
  "Café",
  "Getting around",
  "Appointments",
] as const;
const phrases: Record<(typeof contexts)[number], string[]> = {
  Everyday: [
    "Hello, nice to meet you.",
    "I’m Deaf. Please type your reply.",
    "Could you say that another way?",
    "Thank you for your patience.",
  ],
  Café: [
    "I’d like to order, please.",
    "Could I see the menu?",
    "Does this contain any nuts?",
    "Could I have the bill, please?",
  ],
  "Getting around": [
    "Could you show me the way?",
    "Which platform do I need?",
    "Please let me know when we arrive.",
    "Is this seat available?",
  ],
  Appointments: [
    "I need a qualified sign language interpreter.",
    "Please write that down for me.",
    "I have an appointment.",
    "I need help, please.",
  ],
};
const edges = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];

function Dialog({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={className}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("translate");
  const [camera, setCamera] = useState<CameraState>("off");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [frame, setFrame] = useState<FrameResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [context, setContext] = useState<(typeof contexts)[number]>("Everyday");
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [undoMessage, setUndoMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  const [haptics, setHaptics] = useState(() => readSetting("haptics", true));
  const [largeText, setLargeText] = useState(() =>
    readSetting("largeText", false),
  );
  const [contrast, setContrast] = useState(() =>
    readSetting("contrast", false),
  );
  const [saved, setSaved] = useState<string[]>(() => {
    const value = readSetting<unknown>("phrases", []);
    return Array.isArray(value)
      ? value.filter((x): x is string => typeof x === "string").slice(0, 30)
      : [];
  });
  const [newPhrase, setNewPhrase] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const messageBox = useRef<HTMLTextAreaElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const engine = useRef<SignEngine | null>(null);
  const enginePromise = useRef<Promise<SignEngine> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const speech = useRef<SpeechInstance | null>(null);
  const gate = useRef(new StabilityGate());
  const hapticsRef = useRef(haptics);
  hapticsRef.current = haptics;
  const buzz = useCallback((pattern: number | number[] = 12) => {
    if (hapticsRef.current && typeof navigator.vibrate === "function")
      navigator.vibrate(pattern);
  }, []);
  const notify = useCallback(
    (text: string, previousMessage: string | null = null) => {
      setToast(text);
      setUndoMessage(previousMessage);
    },
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => {
      setToast("");
      setUndoMessage(null);
    }, 6500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!captureFlash) return;
    const id = setTimeout(() => setCaptureFlash(false), 500);
    return () => clearTimeout(id);
  }, [captureFlash]);

  const stopCamera = useCallback(() => {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setCamera("off");
    setFrame(null);
    setProgress(0);
    gate.current.reset();
  }, []);
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) {
        stopCamera();
        speech.current?.abort();
        window.speechSynthesis?.cancel();
        setSpeaking(false);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      stopCamera();
      speech.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, [stopCamera]);

  const startCamera = async () => {
    stopCamera();
    setError("");
    setCamera("loading");
    buzz();
    const run = generation.current;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error("secure-context");
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
      });
      if (run !== generation.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      media.getVideoTracks()[0].onended = () => {
        if (run === generation.current) {
          stopCamera();
          notify("Camera disconnected. Connect it and try again.");
        }
      };
      video.current!.srcObject = media;
      await video.current!.play();
      if (!enginePromise.current)
        enginePromise.current = import("./lib/engine")
          .then(({ SignEngine }) => SignEngine.create())
          .catch((err) => {
            enginePromise.current = null;
            throw err;
          });
      engine.current = await enginePromise.current;
      if (run !== generation.current) return;
      setCamera("live");
      buzz([15, 35, 15]);
      let previousTime = -1;
      const tick = async () => {
        if (run !== generation.current || !video.current || !engine.current)
          return;
        try {
          if (
            video.current.readyState >= 2 &&
            previousTime !== video.current.currentTime
          ) {
            previousTime = video.current.currentTime;
            const prediction = await engine.current.predict(video.current);
            if (run !== generation.current) return;
            setFrame(prediction);
            if (editingRef.current) gate.current.reset();
            const result = gate.current.update(
              editingRef.current ? null : prediction.letter,
              performance.now(),
              prediction.landmarks.length > 0,
            );
            setProgress(result.progress);
            if (result.committed) {
              setMessage((old) => (old + result.committed).slice(0, 1000));
              buzz([18, 25, 18]);
              setCaptureFlash(true);
            }
          }
          timer.current = setTimeout(tick, 140);
        } catch {
          if (run === generation.current) {
            stopCamera();
            setCamera("error");
            setError(
              "Recognition paused. Your message is safe. Try the camera again or keep typing.",
            );
          }
        }
      };
      void tick();
    } catch (err) {
      if (run !== generation.current) return;
      stopCamera();
      setCamera("error");
      const name = err instanceof Error ? err.name : "";
      const detail = err instanceof Error ? err.message : "";
      setError(
        name === "NotAllowedError"
          ? "Camera access is off. Allow camera access in your browser’s site settings, then try again."
          : name === "NotFoundError"
            ? "No camera found. Connect a camera, or use the message box to start a conversation."
            : name === "NotReadableError"
              ? "Your camera is busy. Close other apps using it, then try again."
              : detail === "secure-context"
                ? "Camera access needs HTTPS or localhost. You can still type, show, and speak messages here."
                : "The recognition model could not load. Check your connection and try again. You can still type your message.",
      );
    }
  };
  const startDemo = () => {
    stopCamera();
    setCamera("demo");
    setError("");
    buzz();
    const run = generation.current;
    let i = 0;
    const sample = "HELLO";
    const tick = () => {
      if (generation.current !== run) return;
      if (i < sample.length) {
        setFrame({
          letter: sample[i++],
          confidence: 0,
          landmarks: [],
          latency: 0,
        });
        setProgress(i / sample.length);
        timer.current = setTimeout(tick, 950);
      } else {
        stopCamera();
        notify("Demo complete. Start your camera to try fingerspelling.");
      }
    };
    tick();
    requestAnimationFrame(() =>
      document
        .querySelector(".camera-stage")
        ?.scrollIntoView({ block: "center", behavior: "instant" }),
    );
  };
  const switchTab = (next: Tab) => {
    if (next !== "translate") stopCamera();
    setTab(next);
    window.scrollTo({ top: 0, behavior: "instant" });
    buzz();
  };
  const usePhrase = (phrase: string) => {
    setMessage(phrase);
    setTab("translate");
    buzz();
    notify("Phrase ready. You can edit, show, or speak it.", message || null);
    requestAnimationFrame(() =>
      messageBox.current?.scrollIntoView({
        block: "center",
        behavior: "instant",
      }),
    );
  };
  const speak = () => {
    if (speaking) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      return;
    }
    if (!("speechSynthesis" in window)) {
      notify(
        "Speech isn’t available in this browser. Use Show message instead.",
      );
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      notify("Speech stopped. You can show your message instead.");
    };
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
    buzz();
  };
  const startListening = () => {
    const Recognition =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Recognition) {
      notify(
        "Live captions aren’t supported here. Your conversation partner can type a reply below.",
      );
      setModal(null);
      return;
    }
    const recognition = new Recognition();
    speech.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++)
        if (event.results[i].isFinal)
          setReply((old) =>
            `${old} ${event.results[i][0].transcript}`.trim().slice(0, 2000),
          );
    };
    recognition.onerror = (event) => {
      setListening(false);
      notify(
        event.error === "not-allowed"
          ? "Microphone access is off. Allow it in site settings or type a reply."
          : "Captions stopped. Try again or type a reply.",
      );
    };
    recognition.onend = () => setListening(false);
    try {
      recognition.start();
      setListening(true);
      setModal(null);
      buzz();
    } catch {
      notify("Microphone unavailable. You can type a reply instead.");
    }
  };
  const savePhrase = (text: string) => {
    const value = text.trim();
    if (!value) return;
    if (saved.includes(value)) {
      notify("That phrase is already saved.");
      return;
    }
    if (saved.length >= 30) {
      notify("You have 30 saved phrases. Remove one before adding another.");
      return;
    }
    const next = [...saved, value];
    setSaved(next);
    setNewPhrase("");
    notify(
      saveSetting("phrases", next)
        ? "Phrase saved on this device."
        : "Saved for this visit. Browser storage is unavailable.",
    );
    buzz([12, 30, 12]);
  };
  const active = camera === "live";
  const currentStatus =
    camera === "loading"
      ? "Preparing your camera"
      : camera === "demo"
        ? "Guided demo · sample"
        : active
          ? editing
            ? "Capture paused while you type"
            : frame?.landmarks.length
              ? frame.letter
                ? "Hold your sign"
                : "Adjust your hand"
              : "Ready when you are"
          : "Camera off";

  return (
    <div
      className={`app ${largeText ? "large-text" : ""} ${contrast ? "high-contrast" : ""}`}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <button
          className="brand"
          onClick={() => switchTab("translate")}
          aria-label="Signify home"
        >
          <span className="brand-mark">
            <Hand size={24} strokeWidth={1.65} />
          </span>
          signify<span className="brand-period">.</span>
        </button>
        <nav aria-label="Main navigation" className="main-nav">
          <button
            className={tab === "translate" ? "selected" : ""}
            aria-current={tab === "translate" ? "page" : undefined}
            onClick={() => switchTab("translate")}
          >
            <ScanLine size={17} />
            Translate
          </button>
          <button
            className={tab === "phrases" ? "selected" : ""}
            aria-current={tab === "phrases" ? "page" : undefined}
            onClick={() => switchTab("phrases")}
          >
            <MessageCircle size={17} />
            Phrasebook
          </button>
          <button
            className={tab === "guide" ? "selected" : ""}
            aria-current={tab === "guide" ? "page" : undefined}
            onClick={() => switchTab("guide")}
          >
            <BookOpen size={17} />
            Getting started
          </button>
        </nav>
        <div className="header-right">
          <span className="privacy-note">
            <span className="status-dot" />A space to connect
          </span>
          <button
            className="icon-button settings-button"
            aria-label="Open preferences"
            onClick={() => setModal("settings")}
          >
            <Settings2 size={19} />
          </button>
        </div>
      </header>

      <main id="main">
        {tab === "translate" && (
          <>
            <section className="page-intro">
              <div>
                <p className="eyebrow">
                  <span className="tiny-orbit" />
                  Human connection, in every form.
                </p>
                <h1>A little less distance.</h1>
              </div>
              <p>
                From your hands to their understanding. <br />
                Make room for a better conversation.
              </p>
            </section>
            <div className="workspace">
              <section
                className={`camera-stage ${active ? "is-live" : ""} ${captureFlash ? "captured" : ""}`}
                aria-label="Camera and sign recognition"
              >
                <div
                  className="camera-art"
                  role="img"
                  aria-label="Monochrome study of an open hand"
                />
                <video
                  ref={video}
                  muted
                  playsInline
                  className={
                    active || camera === "loading"
                      ? "camera-video visible"
                      : "camera-video"
                  }
                  aria-label="Your mirrored camera preview"
                  aria-hidden={!active}
                />
                {active && frame && frame.landmarks.length > 0 && (
                  <svg
                    className="landmarks"
                    viewBox={`0 0 ${video.current?.videoWidth || 960} ${video.current?.videoHeight || 720}`}
                    preserveAspectRatio="xMidYMid meet"
                    aria-hidden="true"
                  >
                    {edges.map(([a, b]) => (
                      <line
                        key={`${a}-${b}`}
                        x1={
                          frame.landmarks[a].x *
                          (video.current?.videoWidth || 960)
                        }
                        y1={
                          frame.landmarks[a].y *
                          (video.current?.videoHeight || 720)
                        }
                        x2={
                          frame.landmarks[b].x *
                          (video.current?.videoWidth || 960)
                        }
                        y2={
                          frame.landmarks[b].y *
                          (video.current?.videoHeight || 720)
                        }
                      />
                    ))}
                    {frame.landmarks.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x * (video.current?.videoWidth || 960)}
                        cy={p.y * (video.current?.videoHeight || 720)}
                        r="4"
                      />
                    ))}
                  </svg>
                )}
                <div className="camera-top">
                  <button
                    className="glass-pill language-pill"
                    onClick={() => setModal("about")}
                  >
                    <Hand size={15} />
                    ASL fingerspelling
                    <ChevronDown size={13} />
                  </button>
                  <span className="glass-pill camera-status">
                    <span
                      className={`status-dot ${active ? "live" : "neutral"}`}
                    />
                    {camera === "demo"
                      ? "Demo"
                      : camera === "loading"
                        ? "Loading"
                        : active
                          ? "Camera live"
                          : "Camera off"}
                  </span>
                </div>
                <div className="viewfinder" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="camera-side-label" aria-hidden="true">
                  A new way to be understood
                </div>
                {(active || camera === "demo") && (
                  <div className="recognition-bubble">
                    <span>
                      {camera === "demo" ? "Sample letter" : "Suggested letter"}
                    </span>
                    <strong>{frame?.letter || "—"}</strong>
                    <div className="hold-track">
                      <div style={{ width: `${progress * 100}%` }} />
                    </div>
                    <small>
                      {camera === "demo"
                        ? "Preview only"
                        : captureFlash
                          ? "Added to your message"
                          : "Hold to add · lower hand to repeat"}
                    </small>
                  </div>
                )}
                <div className="camera-bottom">
                  {active && message && (
                    <div className="live-transcript">
                      <span>Your message</span>
                      <p>{message.slice(-80)}</p>
                      <button
                        onClick={() => {
                          messageBox.current?.scrollIntoView({
                            block: "center",
                            behavior: window.matchMedia(
                              "(prefers-reduced-motion: reduce)",
                            ).matches
                              ? "instant"
                              : "smooth",
                          });
                          messageBox.current?.focus({ preventScroll: true });
                        }}
                      >
                        Edit
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                  )}
                  {camera === "off" && (
                    <div className="camera-welcome">
                      <span className="glass-mini">
                        <Sparkles size={13} />
                        Connection starts here
                      </span>
                      <h2>
                        Your hands.
                        <br />
                        Your voice.
                      </h2>
                      <p>A little technology. A lot more understanding.</p>
                    </div>
                  )}
                  {camera === "error" && (
                    <div className="camera-error" role="alert">
                      <CameraOff size={23} />
                      <h2>Let’s get you connected.</h2>
                      <p>{error}</p>
                    </div>
                  )}
                  {(active || camera === "loading" || camera === "demo") && (
                    <div className="live-guidance" role="status">
                      <span className="status-dot" />
                      {currentStatus}
                      {active && (
                        <small>
                          {frame?.landmarks.length
                            ? "Keep one hand in frame, in even light."
                            : "Raise one hand with your palm toward the camera."}
                        </small>
                      )}
                    </div>
                  )}
                  <div className="camera-dock">
                    <div className="dock-hint">
                      <ShieldCheck size={17} />
                      <span>
                        {camera === "demo"
                          ? "No camera needed"
                          : "Video stays on your device"}
                      </span>
                    </div>
                    <button
                      className="camera-start"
                      onClick={
                        camera === "live" ||
                        camera === "loading" ||
                        camera === "demo"
                          ? () => {
                              stopCamera();
                              buzz();
                            }
                          : startCamera
                      }
                    >
                      {camera === "loading" ? (
                        <LoaderCircle size={18} className="spin" />
                      ) : active || camera === "demo" ? (
                        <Square size={16} />
                      ) : (
                        <Camera size={18} />
                      )}
                      <span>
                        {camera === "loading"
                          ? "Cancel"
                          : active || camera === "demo"
                            ? "Stop camera"
                            : camera === "error"
                              ? "Try again"
                              : "Start camera"}
                      </span>
                      <span className="button-circle">
                        <ArrowUpRight size={16} />
                      </span>
                    </button>
                  </div>
                </div>
              </section>

              <aside className="conversation-panel" aria-label="Conversation">
                <div className="panel-top">
                  <span className="panel-label">
                    <MessageCircle size={17} />
                    Your conversation
                  </span>
                  <span className="session-badge">This session</span>
                </div>
                <div className="message-heading">
                  <h2>
                    Let’s make <br />
                    ourselves understood.
                  </h2>
                  <p>Sign a letter, type a thought, or pick a phrase.</p>
                </div>
                <div
                  className={`message-composer ${captureFlash ? "flash" : ""}`}
                >
                  <label htmlFor="message">
                    Your message <span>Editable, always</span>
                  </label>
                  <textarea
                    id="message"
                    ref={messageBox}
                    value={message}
                    onFocus={() => {
                      editingRef.current = true;
                      setEditing(true);
                    }}
                    onBlur={() => {
                      editingRef.current = false;
                      setEditing(false);
                      gate.current.reset();
                    }}
                    maxLength={1000}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Every conversation starts with a hello…"
                  />
                  <div className="composer-tools">
                    <button
                      onClick={() => {
                        setMessage((v) => (v + " ").slice(0, 1000));
                        buzz();
                      }}
                      disabled={!message}
                      aria-label="Add a space"
                    >
                      Space <span>␣</span>
                    </button>
                    <button
                      onClick={() => {
                        setMessage((v) => v.slice(0, -1));
                        buzz();
                      }}
                      disabled={!message}
                      aria-label="Delete last character"
                    >
                      Delete
                    </button>
                    <span>{message.length}/1000</span>
                  </div>
                </div>
                <div className="message-actions">
                  <button
                    className="primary-button"
                    disabled={!message.trim()}
                    onClick={speak}
                  >
                    {speaking ? <Square size={17} /> : <Volume2 size={18} />}{" "}
                    {speaking ? "Stop speaking" : "Speak message"}
                  </button>
                  <button
                    className="secondary-button show-button"
                    disabled={!message.trim()}
                    onClick={() => {
                      stopCamera();
                      setModal("present");
                      buzz();
                    }}
                  >
                    <Expand size={17} />
                    Show
                  </button>
                </div>
                <div className="minor-actions">
                  <button
                    disabled={!message.trim()}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(message);
                        notify("Message copied.");
                      } catch {
                        notify(
                          "Copy isn’t available. Select the text in your message to copy it.",
                        );
                      }
                    }}
                  >
                    <Copy size={13} />
                    Copy
                  </button>
                  <button
                    disabled={!message.trim()}
                    onClick={() => savePhrase(message)}
                  >
                    <Plus size={14} />
                    Save phrase
                  </button>
                  <button
                    disabled={!message}
                    onClick={() => {
                      setMessage("");
                      gate.current.reset();
                      notify("Message cleared.", message);
                    }}
                  >
                    <RotateCcw size={13} />
                    Clear
                  </button>
                </div>
                <div className="reply-section">
                  <div className="reply-heading">
                    <label htmlFor="reply">
                      Their side of the conversation
                    </label>
                    <button
                      className={`icon-button ${listening ? "listening" : ""}`}
                      aria-label={
                        listening ? "Stop live captions" : "Start live captions"
                      }
                      onClick={() =>
                        listening
                          ? speech.current?.stop()
                          : setModal("microphone")
                      }
                    >
                      {listening ? <Square size={15} /> : <Mic size={17} />}
                    </button>
                  </div>
                  <textarea
                    id="reply"
                    value={reply}
                    maxLength={2000}
                    placeholder={
                      listening
                        ? "Listening… speech will appear here."
                        : "Pass the conversation. They can type here."
                    }
                    onChange={(e) => setReply(e.target.value)}
                  />
                  {listening && (
                    <span className="caption-status" role="status">
                      <span className="status-dot" />
                      Listening · tap stop when finished
                    </span>
                  )}
                </div>
                <div className="session-note">
                  <ShieldCheck size={14} />
                  <span>
                    Messages disappear when you leave.
                    <br />
                    Only phrases you save stay on this device.
                  </span>
                </div>
              </aside>
            </div>
            <section className="under-camera">
              <span>
                <Info size={15} />
                An early step: 24 static ASL letters. Review before sharing.
              </span>
              <button onClick={startDemo}>
                Try a guided demo
                <ArrowUpRight size={14} />
              </button>
            </section>
            <section className="quick-section">
              <div className="section-heading">
                <div>
                  <span className="small-caption">
                    A little help finding the words
                  </span>
                  <h2>Everyday moments, made easier.</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => switchTab("phrases")}
                >
                  Open phrasebook
                  <ArrowUpRight size={16} />
                </button>
              </div>
              <div className="quick-phrases">
                {[
                  "Hello, nice to meet you.",
                  "I’m Deaf. Please type your reply.",
                  "Thank you for your patience.",
                ].map((phrase, index) => (
                  <button key={phrase} onClick={() => usePhrase(phrase)}>
                    <span className={`phrase-icon tone-${index}`}>
                      {index === 0 ? (
                        <Hand size={20} />
                      ) : index === 1 ? (
                        <Keyboard size={20} />
                      ) : (
                        <Heart size={20} />
                      )}
                    </span>
                    <span>{phrase}</span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === "phrases" && (
          <section className="library-page">
            <div className="page-intro">
              <div>
                <p className="eyebrow">
                  <MessageCircle size={15} />
                  Ready for real life.
                </p>
                <h1>The right words, ready.</h1>
              </div>
              <p>
                Small moments deserve easy conversations.
                <br />
                Pick a phrase. Make it yours.
              </p>
            </div>
            <div className="context-tabs" aria-label="Phrase categories">
              {contexts.map((item) => (
                <button
                  key={item}
                  className={context === item ? "selected" : ""}
                  aria-pressed={context === item}
                  onClick={() => {
                    setContext(item);
                    buzz();
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="phrase-grid">
              {phrases[context].map((phrase, i) => (
                <button
                  className="phrase-card"
                  key={phrase}
                  onClick={() => usePhrase(phrase)}
                >
                  <span className="phrase-card-number">
                    <MessageCircle size={20} />
                    <span>{context}</span>
                  </span>
                  <h2>{phrase}</h2>
                  <span className="phrase-card-bottom">
                    Use this phrase
                    <ArrowUpRight size={20} />
                  </span>
                  <span className="phrase-watermark" aria-hidden="true">
                    {i === 0 ? "“" : ""}
                  </span>
                </button>
              ))}
            </div>
            <section className="saved-section">
              <div className="section-heading">
                <div>
                  <span className="small-caption">
                    Familiar words. A little more you.
                  </span>
                  <h2>Your saved phrases</h2>
                </div>
                <span className="small-caption">
                  Stored only on this device
                </span>
              </div>
              <form
                className="phrase-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  savePhrase(newPhrase);
                }}
              >
                <label className="sr-only" htmlFor="new-phrase">
                  New personal phrase
                </label>
                <input
                  id="new-phrase"
                  value={newPhrase}
                  maxLength={300}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  placeholder="Something you say often…"
                />
                <button className="primary-button" disabled={!newPhrase.trim()}>
                  <Plus size={17} />
                  Save phrase
                </button>
              </form>
              {saved.length ? (
                <div className="saved-list">
                  {saved.map((phrase) => (
                    <div key={phrase}>
                      <button onClick={() => usePhrase(phrase)}>
                        {phrase}
                        <ArrowUpRight size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Remove saved phrase: ${phrase}`}
                        onClick={() => {
                          const next = saved.filter((p) => p !== phrase);
                          setSaved(next);
                          saveSetting("phrases", next);
                          notify("Saved phrase removed.");
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-note">
                  Your usual coffee order. An introduction. A question you ask
                  every day.
                  <br />
                  Save a phrase above and it’ll be here next time.
                </p>
              )}
            </section>
          </section>
        )}

        {tab === "guide" && (
          <section className="guide-page">
            <div className="page-intro">
              <div>
                <p className="eyebrow">
                  <Hand size={15} />
                  Go at your own pace.
                </p>
                <h1>A hand getting started.</h1>
              </div>
              <button
                className="primary-button"
                onClick={() => switchTab("translate")}
              >
                Try it out
                <ArrowUpRight size={17} />
              </button>
            </div>
            <div className="guide-layout">
              <div className="guide-steps">
                <h2>
                  Make a little room
                  <br />
                  for connection.
                </h2>
                {[
                  {
                    icon: Camera,
                    title: "Find your light.",
                    body: "Face your camera in even light. Keep one hand fully visible, with a simple background behind you.",
                  },
                  {
                    icon: Hand,
                    title: "One letter at a time.",
                    body: "Hold a static ASL letter for about a second. The progress bar fills as it settles. Lower your hand briefly to repeat a letter.",
                  },
                  {
                    icon: MessageCircle,
                    title: "Make the message yours.",
                    body: "Check each letter. Add spaces, edit anything, then show your message or speak it aloud.",
                  },
                ].map(({ icon: Icon, title, body }, i) => (
                  <div className="guide-step" key={title}>
                    <span>
                      <Icon size={22} />
                    </span>
                    <div>
                      <small>Step {i + 1}</small>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </div>
                ))}
                <button
                  className="secondary-button"
                  onClick={() => {
                    switchTab("translate");
                    startDemo();
                  }}
                >
                  Watch the guided demo
                  <ArrowRight size={17} />
                </button>
              </div>
              <div className="alphabet-panel">
                <div>
                  <span className="panel-label">A reference within reach</span>
                  <h2>The ASL alphabet.</h2>
                </div>
                <img
                  src="/asl-chart.jpg"
                  alt="ASL alphabet reference showing hand positions for letters A through Z"
                />
                <p>
                  Camera recognition supports {LETTERS.length} static letters. J
                  and Z use movement; type these letters manually.
                </p>
                <a
                  className="text-button"
                  href="https://www.lifeprint.com/asl101/fingerspelling/fingerspelling.htm"
                  target="_blank"
                  rel="noreferrer"
                >
                  Learn fingerspelling with ASL University
                  <ArrowUpRight size={15} />
                </a>
              </div>
            </div>
            <div className="honesty-note">
              <ShieldCheck size={24} />
              <div>
                <h3>A communication aid, with room to grow.</h3>
                <p>
                  Sign languages are complete languages, with movement, facial
                  expression, and their own grammar. This research model
                  recognizes static fingerspelling, not full sign language. It
                  can make mistakes. For medical, legal, or other critical
                  conversations, use a qualified interpreter.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
      <footer>
        <span>
          <span className="footer-mark">✳</span>Made for connection. Designed
          for everyone.
        </span>
        <button onClick={() => setModal("about")}>
          A thoughtful work in progress
          <ArrowUpRight size={13} />
        </button>
        <span>Signify © {new Date().getFullYear()}</span>
      </footer>
      <div className={`toast ${toast ? "visible" : ""}`} role="status">
        {toast && (
          <>
            <Check size={16} />
            {toast}
            {undoMessage !== null && (
              <button
                onClick={() => {
                  setMessage(undoMessage);
                  setUndoMessage(null);
                  notify("Message restored.");
                }}
              >
                Undo
              </button>
            )}
          </>
        )}
      </div>

      {modal === "settings" && (
        <Dialog
          title="Make yourself comfortable."
          onClose={() => setModal(null)}
        >
          <p className="dialog-description">
            A few small adjustments, a better experience for you.
          </p>
          <div className="setting-row">
            <div>
              <Smartphone size={19} />
              <span>
                <strong>Haptic feedback</strong>
                <small>
                  {typeof navigator.vibrate === "function"
                    ? "A gentle tap when a letter is captured."
                    : "Vibration isn’t supported by this browser. Visual feedback is always on."}
                </small>
              </span>
            </div>
            <button
              className="toggle"
              role="switch"
              aria-label="Haptic feedback"
              aria-checked={haptics}
              disabled={typeof navigator.vibrate !== "function"}
              onClick={() => {
                setHaptics(!haptics);
                saveSetting("haptics", !haptics);
                if (!haptics) navigator.vibrate?.(15);
              }}
            >
              <span />
            </button>
          </div>
          <div className="setting-row">
            <div>
              <Expand size={19} />
              <span>
                <strong>Larger conversation text</strong>
                <small>A little more room for your words.</small>
              </span>
            </div>
            <button
              className="toggle"
              role="switch"
              aria-label="Larger conversation text"
              aria-checked={largeText}
              onClick={() => {
                setLargeText(!largeText);
                saveSetting("largeText", !largeText);
              }}
            >
              <span />
            </button>
          </div>
          <div className="setting-row">
            <div>
              <ScanLine size={19} />
              <span>
                <strong>Higher contrast</strong>
                <small>Stronger outlines and darker supporting text.</small>
              </span>
            </div>
            <button
              className="toggle"
              role="switch"
              aria-label="Higher contrast"
              aria-checked={contrast}
              onClick={() => {
                setContrast(!contrast);
                saveSetting("contrast", !contrast);
              }}
            >
              <span />
            </button>
          </div>
          <p className="settings-footnote">
            Motion follows your device’s reduced-motion preference. Settings
            stay on this device.
          </p>
        </Dialog>
      )}
      {modal === "about" && (
        <Dialog
          title="Built around understanding."
          onClose={() => setModal(null)}
        >
          <div className="about-symbol">
            <Hand size={36} />
          </div>
          <p>
            Signify pairs the original Sign-MNIST CNN with hand tracking to
            recognize <strong>24 static ASL letters</strong> in your browser. J,
            Z, moving signs, and full sentences aren’t supported by the camera
            model.
          </p>
          <p>
            Recognition is experimental. Model confidence is not proof of
            correctness. Review and edit your message before sharing it.
          </p>
          <div className="privacy-box">
            <ShieldCheck size={20} />
            <span>
              <strong>Your camera stays yours.</strong>
              <br />
              Video is processed on this device, never uploaded or recorded.
              Live speech captions are optional and may use your browser’s
              speech service.
            </span>
          </div>
          <p className="small-caption">
            A communication aid, not a replacement for a qualified interpreter.
            Built on the original Signify research project.
          </p>
          <button
            className="primary-button full-width"
            onClick={() => {
              setModal(null);
              switchTab("guide");
            }}
          >
            Explore the getting-started guide
            <ArrowRight size={17} />
          </button>
        </Dialog>
      )}
      {modal === "present" && (
        <Dialog
          title="Your message"
          className="present-dialog"
          onClose={() => setModal(null)}
        >
          <div className="present-message">{message}</div>
          <p>Take your time. We’re listening.</p>
          <button className="primary-button" onClick={speak}>
            {speaking ? <Square size={19} /> : <Volume2 size={19} />}{" "}
            {speaking ? "Stop speaking" : "Speak message"}
          </button>
        </Dialog>
      )}
      {modal === "microphone" && (
        <Dialog
          title="Give their words a place."
          onClose={() => setModal(null)}
        >
          <div className="about-symbol">
            <AudioLines size={34} />
          </div>
          <p>
            Turn speech into readable captions on their side of the
            conversation. Your browser may send audio to its speech recognition
            provider to process it.
          </p>
          <p>
            Ask your conversation partner before starting. Captions can make
            mistakes; you can edit the text together.
          </p>
          <button
            className="primary-button full-width"
            onClick={startListening}
          >
            <Mic size={18} />
            Start live captions
          </button>
          <button
            className="text-button centered"
            onClick={() => {
              setModal(null);
              document.getElementById("reply")?.focus();
            }}
          >
            Type a reply instead
            <ArrowDown size={15} />
          </button>
        </Dialog>
      )}
    </div>
  );
}
