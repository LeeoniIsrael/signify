import { useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { CameraView } from "expo-camera";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { Props, CameraPrediction } from "./index";

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
const csp =
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; img-src data: blob:; connect-src blob:; worker-src blob:; style-src 'unsafe-inline'";

export default function ExpoCameraEngine({
  style,
  active,
  onPrediction,
  onStatus,
}: Props) {
  const camera = useRef<CameraView>(null);
  const web = useRef<WebView>(null);
  const callbacks = useRef({ onPrediction, onStatus });
  callbacks.current = { onPrediction, onStatus };
  const running = useRef(false);
  const cameraReady = useRef(false);
  const engineReady = useRef(false);
  const processing = useRef(false);
  const frameId = useRef(0);
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
      !active ||
      !cameraReady.current ||
      !engineReady.current ||
      processing.current
    )
      return;
    processing.current = true;
    let uri: string | undefined;
    try {
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
      if (!running.current) return;
      if (!photo?.base64) throw new Error("No camera frame");
      await send({
        type: "frame",
        id: ++frameId.current,
        base64: photo.base64,
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
      if (running.current)
        timer.current = setTimeout(() => void capture(), 150);
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
      } else if (data.type === "boot") void boot();
      else if (data.type === "status")
        callbacks.current.onStatus({ nativeEvent: data });
      else if (data.type === "ready") {
        clearTimeout(deadline.current);
        engineReady.current = true;
        callbacks.current.onStatus({ nativeEvent: { state: "live" } });
        if (__DEV__)
          console.info("Signify: on-device hand tracker and CNN ready");
        void capture();
      } else if (data.type === "prediction" && data.id === frameId.current) {
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
    running.current = active;
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
        if (running.current)
          setHtml(
            `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><script>${source.replace(/<\/script/gi, "<\\/script")}</script>`,
          );
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
      for (const wait of pending.current.values()) {
        clearTimeout(wait.timeout);
        wait.reject(new Error("Camera stopped"));
      }
      pending.current.clear();
    };
    // The camera component is mounted for one translation session, and unmounted on stop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return (
    <View style={style}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="front"
        active={active}
        pictureSize={pictureSize}
        onCameraReady={async () => {
          try {
            const sizes = await camera.current?.getAvailablePictureSizesAsync();
            const preferred = sizes
              ?.filter((size) => /^\d+x\d+$/.test(size))
              .sort((a, b) => {
                const area = (s: string) =>
                  s.split("x").reduce((x, y) => x * Number(y), 1);
                return (
                  Math.abs(area(a) - 640 * 480) - Math.abs(area(b) - 640 * 480)
                );
              })[0];
            if (running.current && preferred) setPictureSize(preferred);
          } catch {
            /* Use the camera's default size if not available. */
          }
          cameraReady.current = true;
          timer.current = setTimeout(() => void capture(), 250);
        }}
        onMountError={() =>
          fail(
            "Your camera is unavailable. Try again on a phone or type your message.",
          )
        }
      />
      {html ? (
        <WebView
          ref={web}
          source={{ html }}
          originWhitelist={["*"]}
          javaScriptEnabled
          style={{ width: 1, height: 1, opacity: 0 }}
          containerStyle={{ position: "absolute", width: 1, height: 1 }}
          pointerEvents="none"
          accessible={false}
          onMessage={receive}
          onShouldStartLoadWithRequest={(request) =>
            request.url === "about:blank"
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
