import { chromium, webkit } from "@playwright/test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
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
      `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; img-src data: blob:; connect-src blob:; worker-src blob:"><script>window.events=[];window.ReactNativeWebView={postMessage:m=>events.push(JSON.parse(m))};</script>`,
    );
    await page.addScriptTag({ content: source });
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
