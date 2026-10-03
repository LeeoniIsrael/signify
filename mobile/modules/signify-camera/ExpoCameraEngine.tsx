import { useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { CameraView } from "expo-camera";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { Props, CameraPrediction } from "./index";
import { processorHtml } from "../../vision/document.mjs";

// These are packaged locally, including both WASM runtimes. No CDN or server inference.
const resources = {
  mpLoader: require("../../assets/vision/mp-loader.cvdata"),
  mpWasm: require("../../assets/vision/mp-wasm.cvdata"),
  ortLoader: require("../../assets/vision/ort-loader.cvdata"),
  ortWasm: require("../../assets/vision/ort-wasm.cvdata"),
  hands: require("../../assets/hand_landmarker.task"),
  cnn: require("../../assets/signlanguage.onnx"),
};
const processor = require("../../assets/vision/processor.cvdata");

export default function ExpoCameraEngine({
  style,
  active,
  onPrediction,
  onStatus,
  onAnalysis,
}: Props) {
  const camera = useRef<CameraView>(null);
  const web = useRef<WebView>(null);
  const callbacks = useRef({ onPrediction, onStatus, onAnalysis });
  callbacks.current = { onPrediction, onStatus, onAnalysis };
  const running = useRef(false);
  const enabled = useRef(active);
  enabled.current = active;
  const mode = useRef("idle");
  const captureSession = useRef(0);
  const streamTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [snapshot, setSnapshot] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const cameraReady = useRef(false);
  const engineReady = useRef(false);
  const processing = useRef(false);
  const frameId = useRef(0);
  const samples = useRef<number[]>([]);
  const captureStarted = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);
  const pending = useRef(
    new Map<
      number,
      {
        resolve: () => void;
        reject: (error: Error) => void;
        timeout: ReturnType<typeof setTimeout>;
      }
    >(),
  );
  const [html, setHtml] = useState("");
  const [pictureSize, setPictureSize] = useState<string>();

  function fail(message: string) {
    if (!running.current) return;
    running.current = false;
    clearTimeout(timer.current);
    clearTimeout(deadline.current);
    callbacks.current.onStatus({ nativeEvent: { state: "error", message } });
  }
  function send(packet: Record<string, unknown>, timeoutMs = 30000) {
    return new Promise<void>((resolve, reject) => {
      if (!running.current || !web.current) {
        reject(new Error("Camera stopped"));
        return;
      }
      const id = ++seq.current;
      const timeout = setTimeout(() => {
        pending.current.delete(id);
        reject(new Error("Recognition did not respond"));
      }, timeoutMs);
      pending.current.set(id, { resolve, reject, timeout });
      web.current.injectJavaScript(
        `window.SignifyVision.receive(${JSON.stringify({ ...packet, seq: id })});true;`,
      );
    });
  }
  async function capture() {
    if (
      !running.current ||
      !enabled.current ||
      !cameraReady.current ||
      !engineReady.current ||
      processing.current
    )
      return;
    processing.current = true;
    const run = captureSession.current;
    let uri: string | undefined;
    try {
      const capturedAt = performance.now();
      captureStarted.current = capturedAt;
      const photo = await camera.current?.takePictureAsync({
        base64: true,
        quality: 0.4,
        skipProcessing: false,
        shutterSound: false,
        exif: false,
      });
      uri = photo?.uri;
      if (uri) {
        new File(uri).delete();
        uri = undefined;
      }
      if (
        !running.current ||
        !enabled.current ||
        run !== captureSession.current
      )
        return;
      if (!photo?.base64) throw new Error("No camera frame");
      await send({
        type: "frame",
        id: ++frameId.current,
        base64: photo.base64,
        captureMs: performance.now() - capturedAt,
      });
    } catch (error) {
      if (running.current)
        fail("Recognition paused. Start again, or type your message.");
      if (__DEV__) console.warn("Camera recognition:", String(error));
    } finally {
      if (uri) {
        try {
          new File(uri).delete();
        } catch {}
      }
      processing.current = false;
      if (running.current && enabled.current && mode.current === "snapshot")
        timer.current = setTimeout(() => void capture(), 0);
    }
  }
  async function boot() {
    try {
      callbacks.current.onStatus({
        nativeEvent: {
          state: "loading",
          message: "Loading on-device recognition…",
        },
      });
      let loaded = 0;
      for (const [name, resource] of Object.entries(resources)) {
        callbacks.current.onStatus({
          nativeEvent: {
            state: "loading",
            message: `Loading recognition files (${++loaded}/6)…`,
          },
        });
        const asset = await Asset.fromModule(resource).downloadAsync();
        if (!running.current) return;
        if (!asset.localUri) throw new Error("Missing recognition asset");
        const base64 = await new File(asset.localUri).base64();
        if (!running.current) return;
        await send({ type: "begin", name });
        for (let i = 0; i < base64.length; i += 192 * 1024) {
          await send({
            type: "part",
            name,
            data: base64.slice(i, i + 192 * 1024),
          });
        }
        await send({ type: "end", name });
      }
      await send({ type: "initialize" }, 60000);
    } catch (error) {
      if (__DEV__)
        console.warn("On-device vision initialization:", String(error));
      fail(
        "Recognition could not start. Check your connection for the first model download, then try again.",
      );
    }
  }
  async function startCamera() {
    if (!running.current || !enabled.current || !engineReady.current) return;
    callbacks.current.onStatus({
      nativeEvent: { state: "loading", message: "Opening your camera…" },
    });
    mode.current = "starting";
    try {
      await send({ type: "stream" });
    } catch {
      if (running.current && enabled.current)
        fail("The camera could not start. Try again.");
      return;
    }
    streamTimeout.current = setTimeout(() => {
      if (running.current && enabled.current && mode.current === "starting") {
        void send({ type: "pause" }).catch(() => {});
        mode.current = "snapshot";
        setSnapshot(true);
      }
    }, 5000);
  }
  function receive(event: WebViewMessageEvent) {
    if (!running.current) return;
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ack") {
        const wait = pending.current.get(data.seq);
        if (wait) {
          clearTimeout(wait.timeout);
          pending.current.delete(data.seq);
          wait.resolve();
        }
      } else if (data.type === "boot") {
        if (__DEV__)
          console.info("Signify vision processor version", data.version);
        void boot();
      } else if (data.type === "status")
        callbacks.current.onStatus({ nativeEvent: data });
      else if (data.type === "ready") {
        clearTimeout(deadline.current);
        engineReady.current = true;
        if (__DEV__)
          console.info("Signify: on-device hand tracker and CNN ready");
        if (enabled.current) void startCamera();
      } else if (data.type === "streamReady") {
        clearTimeout(streamTimeout.current);
        if (!enabled.current || mode.current !== "starting") {
          void send({ type: "pause" }).catch(() => {});
          return;
        }
        if (__DEV__) console.info("Signify: continuous camera stream ready");
        mode.current = "stream";
        setStreaming(true);
        callbacks.current.onStatus({
          nativeEvent: { state: "live", message: "Camera ready" },
        });
      } else if (data.type === "streamUnavailable") {
        if (__DEV__)
          console.info("Signify: using native capture fallback:", data.reason);
        clearTimeout(streamTimeout.current);
        if (enabled.current) {
          mode.current = "snapshot";
          setSnapshot(true);
        }
      } else if (data.type === "activity" && enabled.current) {
        callbacks.current.onAnalysis?.({ nativeEvent: { phase: data.phase } });
      } else if (
        data.type === "prediction" &&
        enabled.current &&
        (mode.current === "stream" || data.id === frameId.current)
      ) {
        const totalMs =
          mode.current === "snapshot"
            ? performance.now() - captureStarted.current
            : data.latencyMs;
        samples.current.push(totalMs);
        if (__DEV__ && samples.current.length === 30) {
          const sorted = samples.current.slice().sort((a, b) => a - b);
          console.info(
            `Signify ${mode.current}: 30-frame latency median ${Math.round(sorted[15])}ms, p95 ${Math.round(sorted[28])}ms; detector ${Math.round(data.detectorMs || 0)}ms, CNN ${Math.round(data.cnnMs || 0)}ms`,
          );
          samples.current = [];
        }
        callbacks.current.onPrediction({
          nativeEvent: data as CameraPrediction,
        });
      } else if (data.type === "error") {
        if (__DEV__) console.warn("On-device vision:", data.message);
        fail(
          "Recognition could not read this frame. Start again, or type your message.",
        );
      }
    } catch {
      fail("Recognition stopped unexpectedly. Please try again.");
    }
  }
  useEffect(() => {
    running.current = true;
    deadline.current = setTimeout(
      () =>
        fail(
          "Recognition is taking too long to load. Check your connection and try again.",
        ),
      120000,
    );
    void (async () => {
      try {
        const asset = await Asset.fromModule(processor).downloadAsync();
        if (!asset.localUri) throw new Error("Processor unavailable");
        const source = await new File(asset.localUri).text();
        if (running.current) setHtml(processorHtml(source));
      } catch {
        fail(
          "Recognition could not load. Check your connection and try again.",
        );
      }
    })();
    return () => {
      running.current = false;
      clearTimeout(timer.current);
      clearTimeout(deadline.current);
      clearTimeout(streamTimeout.current);
      for (const wait of pending.current.values()) {
        clearTimeout(wait.timeout);
        wait.reject(new Error("Camera stopped"));
      }
      pending.current.clear();
    };
    // The processor stays warm across pauses and is disposed on screen exit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    captureSession.current++;
    if (active && engineReady.current) void startCamera();
    if (!active) {
      clearTimeout(timer.current);
      clearTimeout(streamTimeout.current);
      cameraReady.current = false;
      mode.current = "idle";
      setSnapshot(false);
      setStreaming(false);
      if (engineReady.current) void send({ type: "pause" }).catch(() => {});
    }
    // The engine stays warm when capture is paused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return (
    <View style={style}>
      {snapshot && active && (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="front"
          active={active}
          pictureSize={pictureSize}
          onCameraReady={async () => {
            try {
              const sizes =
                await camera.current?.getAvailablePictureSizesAsync();
              const preferred = sizes
                ?.filter((size) => /^\d+x\d+$/.test(size))
                .sort((a, b) => {
                  const area = (s: string) =>
                    s.split("x").reduce((x, y) => x * Number(y), 1);
                  return (
                    Math.abs(area(a) - 640 * 480) -
                    Math.abs(area(b) - 640 * 480)
                  );
                })[0];
              if (running.current && preferred) setPictureSize(preferred);
            } catch {
              /* Use the camera's default size if not available. */
            }
            cameraReady.current = true;
            callbacks.current.onStatus({
              nativeEvent: { state: "live", message: "Camera ready" },
            });
            timer.current = setTimeout(() => void capture(), 250);
          }}
          onMountError={() =>
            fail(
              "Your camera is unavailable. Try again on a phone or type your message.",
            )
          }
        />
      )}
      {html ? (
        <WebView
          ref={web}
          source={{ html, baseUrl: "https://signify.local/" }}
          originWhitelist={["*"]}
          javaScriptEnabled
          style={{
            flex: 1,
            opacity: streaming ? 1 : 0,
            backgroundColor: "transparent",
          }}
          containerStyle={StyleSheet.absoluteFill}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grantIfSameHostElseDeny"
          pointerEvents="none"
          accessible={false}
          onMessage={receive}
          onShouldStartLoadWithRequest={(request) =>
            request.url === "about:blank" ||
            request.url === "https://signify.local/"
          }
          onError={() => fail("Recognition could not load. Please try again.")}
          onContentProcessDidTerminate={() =>
            fail(
              "Recognition ran out of memory. Start again or type your message.",
            )
          }
        />
      ) : null}
    </View>
  );
}
