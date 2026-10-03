import { chromium, webkit } from "@playwright/test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { processorHtml } from "../mobile/vision/document.mjs";
const resources = {
  mpLoader: "mobile/assets/vision/mp-loader.cvdata",
  mpWasm: "mobile/assets/vision/mp-wasm.cvdata",
  ortLoader: "mobile/assets/vision/ort-loader.cvdata",
  ortWasm: "mobile/assets/vision/ort-wasm.cvdata",
  hands: "mobile/assets/hand_landmarker.task",
  cnn: "mobile/assets/signlanguage.onnx",
};
const source = await readFile("mobile/assets/vision/processor.cvdata", "utf8");
const photo = await readFile("mobile/assets/hand-study.png");
for (const [name, launcher] of [
  ["Chromium", chromium],
  ["WebKit", webkit],
]) {
  const browser = await launcher.launch({
    headless: true,
    ...(name === "Chromium"
      ? {
          channel:
            process.env.PLAYWRIGHT_CHANNEL ||
            (process.platform === "darwin" ? "chrome" : undefined),
        }
      : {}),
  });
  try {
    const page = await browser.newPage();
    const requests = [];
    page.on("request", (r) => {
      if (/^https?:/.test(r.url())) requests.push(r.url());
    });
    page.on("pageerror", (e) => console.error(name, "page error:", e.message));
    await page.setContent(
      processorHtml(
        `window.events=[];window.ReactNativeWebView={postMessage:m=>events.push(JSON.parse(m))};${source}`,
      ),
    );
    for (const [key, path] of Object.entries(resources)) {
      const data = (await readFile(path)).toString("base64");
      await page.evaluate(
        async ({ name, data }) => {
          await window.SignifyVision.receive({ type: "begin", name });
          for (let i = 0; i < data.length; i += 192 * 1024)
            await window.SignifyVision.receive({
              type: "part",
              name,
              data: data.slice(i, i + 192 * 1024),
            });
          await window.SignifyVision.receive({ type: "end", name });
        },
        { name: key, data },
      );
    }
    await page.evaluate(() =>
      window.SignifyVision.receive({ type: "initialize" }),
    );
    let events = await page.evaluate(() => window.events);
    assert(!events.some((e) => e.type === "error"), JSON.stringify(events));
    assert(
      events.some((e) => e.type === "ready"),
      "Both models must finish initialization",
    );
    // An empty frame must never produce a letter.
    await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = c.height = 480;
      await window.SignifyVision.receive({
        type: "frame",
        id: 1,
        base64: c.toDataURL("image/jpeg").split(",")[1],
      });
    });
    events = await page.evaluate(() => window.events);
    const empty = events.find((e) => e.type === "prediction" && e.id === 1);
    assert(
      empty && !empty.hasHand && empty.logits.length === 0,
      JSON.stringify(events),
    );
    // A real hand photo must traverse hand tracking, the crop, normalization, and the CNN.
    await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = "data:image/png;base64," + base64;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      await window.SignifyVision.receive({
        type: "frame",
        id: 2,
        base64: canvas.toDataURL("image/jpeg", 0.4).split(",")[1],
      });
    }, photo.toString("base64"));
    events = await page.evaluate(() => window.events);
    const hand = events.find((e) => e.type === "prediction" && e.id === 2);
    assert(
      hand?.hasHand &&
        hand.landmarks.length === 21 &&
        hand.logits.length === 25 &&
        hand.logits.every(Number.isFinite),
      JSON.stringify(events),
    );
    // Exercise continuous video rather than just still-image inference.
    await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = "data:image/png;base64," + base64;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = Math.round(
        (image.naturalHeight * 480) / image.naturalWidth,
      );
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      window.makeStream = () => {
        const stream = canvas.captureStream(30);
        window.testTracks = stream.getTracks();
        return stream;
      };
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia: async () => window.makeStream() },
      });
      window.startPainting = () => {
        window.paint = setInterval(
          () => ctx.drawImage(image, 0, 0, canvas.width, canvas.height),
          33,
        );
      };
      window.startPainting();
      await window.SignifyVision.receive({ type: "stream" });
    }, photo.toString("base64"));
    await page.waitForFunction(
      () =>
        window.events.filter(
          (e) => e.type === "prediction" && e.id === undefined,
        ).length >= 8,
      {},
      { timeout: 20000 },
    );
    const streaming = await page.evaluate(() =>
      window.events.filter(
        (e) => e.type === "prediction" && e.id === undefined,
      ),
    );
    assert(
      streaming.some((p) => p.hasHand && p.logits.length === 25),
      "Continuous frames must reach the actual CNN",
    );
    const median = streaming.map((p) => p.latencyMs).sort((a, b) => a - b)[
      Math.floor(streaming.length / 2)
    ];
    const cnnMedian = streaming.map((p) => p.cnnMs).sort((a, b) => a - b)[
      Math.floor(streaming.length / 2)
    ];
    await page.evaluate(async () => {
      await window.SignifyVision.receive({ type: "pause" });
      clearInterval(window.paint);
    });
    const pausedCount = await page.evaluate(
      () => window.events.filter((e) => e.type === "prediction").length,
    );
    await page.waitForTimeout(400);
    assert.equal(
      await page.evaluate(
        () => window.events.filter((e) => e.type === "prediction").length,
      ),
      pausedCount,
      "No predictions may escape after pause",
    );
    assert(
      await page.evaluate(() =>
        window.testTracks.every((t) => t.readyState === "ended"),
      ),
      "Pause must stop camera tracks",
    );
    // Restart the same initialized models and verify fresh results resume.
    await page.evaluate(async () => {
      window.startPainting();
      await window.SignifyVision.receive({ type: "stream" });
    });
    await page.waitForFunction(
      (count) =>
        window.events.filter((e) => e.type === "prediction").length >=
        count + 3,
      pausedCount,
      { timeout: 10000 },
    );
    assert.equal(
      await page.evaluate(
        () => window.events.filter((e) => e.type === "ready").length,
      ),
      1,
      "Resume must reuse initialized models",
    );
    await page.evaluate(async () => {
      await window.SignifyVision.receive({ type: "pause" });
      clearInterval(window.paint);
    });
    console.log(
      `${name}: continuous video median processing ${Math.round(median)} ms, CNN ${Math.round(cnnMedian)} ms; pause stops tracks and predictions`,
    );
    assert.equal(
      requests.length,
      0,
      "Inference must not contact a server or CDN",
    );
    console.log(
      `${name}: local models ready, empty frame rejected, 21 hand landmarks, 25 real CNN logits (${Math.round(hand.latencyMs)} ms), no network requests`,
    );
  } finally {
    await browser.close();
  }
}
