import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

test("conversation, presentation, phrase persistence and preferences", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A little less distance." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Speak message", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Hello, nice to meet you.", exact: true })
    .click();
  await expect(page.locator("#message")).toHaveValue(
    "Hello, nice to meet you.",
  );
  await page.getByRole("button", { name: "Show", exact: true }).click();
  await expect(page.locator("dialog")).toBeVisible();
  await expect(page.locator(".present-message")).toHaveText(
    "Hello, nice to meet you.",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Save phrase", exact: true }).click();
  await page.getByRole("button", { name: "Phrasebook", exact: true }).click();
  await expect(page.locator(".saved-list")).toContainText(
    "Hello, nice to meet you.",
  );
  await page.getByRole("button", { name: "Café", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Could I see the menu?" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("#message")).toHaveValue("");
  await page.getByRole("button", { name: "Phrasebook", exact: true }).click();
  await expect(page.locator(".saved-list")).toContainText(
    "Hello, nice to meet you.",
  );
  await page.getByRole("button", { name: "Open preferences" }).click();
  await page.getByRole("switch", { name: "Larger conversation text" }).click();
  await expect(
    page.getByRole("switch", { name: "Larger conversation text" }),
  ).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.locator(".app")).toHaveClass(/large-text/);
});

test("camera denial gives an actionable fallback and demo does not change real text", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await page.goto("/");
  await page.locator("#message").fill("My real message");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Camera access is off");
  await page.getByRole("button", { name: "Try a guided demo" }).click();
  await expect(page.getByText("Sample letter", { exact: true })).toBeVisible();
  await expect(page.locator("#message")).toHaveValue("My real message");
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  await expect(page.getByText("Sample letter", { exact: true })).toHaveCount(0);
  await expect(page.locator("#message")).toHaveValue("My real message");
});

test("real model loads locally and recognizes a held-out dataset example", async ({
  page,
}) => {
  await page.goto("/");
  const sample = readFileSync(
    "classifier_model/data/sign_mnist_test.csv",
    "utf8",
  )
    .split("\n")[1]
    .split(",")
    .map(Number);
  const result = await page.evaluate(
    async ({ pixels }) => {
      // Exercise the actual shipped ONNX weights and WASM execution provider.
      const ort =
        await import("/node_modules/onnxruntime-web/dist/ort.wasm.bundle.min.mjs");
      ort.env.wasm.wasmPaths = {
        wasm: "/vendor/ort/ort-wasm-simd-threaded.wasm",
      };
      ort.env.wasm.numThreads = 1;
      const session = await ort.InferenceSession.create(
        "/models/signlanguage.onnx",
        { executionProviders: ["wasm"] },
      );
      const data = Float32Array.from(pixels, (x) => (x / 255 - 0.485) / 0.229);
      const output = await session.run({
        [session.inputNames[0]]: new ort.Tensor(
          "float32",
          data,
          [1, 1, 28, 28],
        ),
      });
      const logits = Array.from(
        output[session.outputNames[0]].data as Float32Array,
      );
      await session.release();
      return {
        count: logits.length,
        index: logits.indexOf(Math.max(...logits)),
      };
    },
    { pixels: sample.slice(1) },
  );
  expect(result.count).toBe(25);
  const originalLabel = sample[0];
  expect(result.index).toBe(
    originalLabel > 9 ? originalLabel - 1 : originalLabel,
  );
});

test("visual layout and core accessibility", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".camera-art")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-home.png`,
    fullPage: true,
  });
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});

test("camera pipeline initializes both models and stops all camera tracks", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d")!;
      const img = new Image();
      img.src = "/hand-study.png";
      await img.decode();
      const draw = () => {
        ctx.drawImage(img, 0, 0, 640, 480);
      };
      draw();
      const id = setInterval(draw, 60);
      const stream = canvas.captureStream(15);
      (window as unknown as { testStream: MediaStream }).testStream = stream;
      stream
        .getVideoTracks()[0]
        .addEventListener("ended", () => clearInterval(id));
      return stream;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.getByText("Camera live", { exact: true })).toBeVisible({
    timeout: 45000,
  });
  await expect(page.locator(".landmarks circle")).toHaveCount(21, {
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  const states = await page.evaluate(() =>
    (window as unknown as { testStream: MediaStream }).testStream
      .getTracks()
      .map((t) => t.readyState),
  );
  expect(states).toEqual(["ended"]);
});

test("draft replacement and clearing can be undone", async ({ page }) => {
  await page.goto("/");
  await page.locator("#message").fill("Please keep this draft.");
  await page
    .getByRole("button", { name: "Hello, nice to meet you.", exact: true })
    .click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#message")).toHaveValue("Please keep this draft.");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator("#message")).toHaveValue("");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#message")).toHaveValue("Please keep this draft.");
});

test("phrasebook, guide, and preferences remain accessible", async ({
  page,
}) => {
  await page.goto("/");
  for (const name of ["Phrasebook", "Getting started", "Open preferences"]) {
    await page.getByRole("button", { name, exact: true }).click();
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          issue: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  }
});
