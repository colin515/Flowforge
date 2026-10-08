import { createWorker } from "tesseract.js";
import { matchTemplate } from "./template-match.js";
import { checkPixel } from "./pixel-check.js";
async function pixels(source) {
  const img = new Image();
  img.src = source;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return { width: img.width, height: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data };
}
export class Vision {
  workerPromise = null;
  templates = new Map();
  worker() {
    return (this.workerPromise ??= createWorker("eng", 1, {
      workerPath: new URL(
        import.meta.env.BASE_URL + "ocr/worker.min.js",
        window.location.href,
      ).href,
      corePath: new URL(
        import.meta.env.BASE_URL + "ocr/core/",
        window.location.href,
      ).href,
      langPath: "https://tessdata.projectnaptha.com/4.0.0",
      logger: () => {},
    }).catch((e) => {
      this.workerPromise = null;
      throw e;
    }));
  }
  async find(frame, b, signal) {
    if (signal.aborted) throw new Error("Stopped");
    if (b.type === "checkPixel") {
      const image = await pixels(frame.data);
      if (signal.aborted) throw new Error("Stopped");
      return checkPixel(image, b.x, b.y, b.color, b.tolerance);
    }
    if (b.type === "findImage") {
      if (!b.template) throw new Error("Upload an image template first");
      if (!this.templates.has(b.template)) {
        if (this.templates.size > 8) this.templates.clear();
        this.templates.set(b.template, pixels(b.template));
      }
      const template = await this.templates.get(b.template);
      if (template.width > 128 || template.height > 128) throw new Error("Template must be at most 128 × 128 pixels");
      const screenshot = await pixels(frame.data);
      if (signal.aborted) throw new Error("Stopped");
      return matchTemplate(screenshot, template, b.confidence, signal);
    }
    if (b.type === "findText") {
      const worker = await this.worker();
      if (signal.aborted) throw new Error("Stopped");
      const { data } = await worker.recognize(frame.data, {}, { blocks: true });
      if (signal.aborted) throw new Error("Stopped");
      // Phrase matching within one OCR line; union bounding box in screenshot pixels.
      const lines = (data.blocks ?? [])
        .flatMap((x) => x.paragraphs ?? [])
        .flatMap((p) => p.lines ?? []);
      const query = b.text.trim().toLowerCase().split(/\s+/);
      for (const line of lines) {
        const words = line.words ?? [];
        for (let i = 0; i <= words.length - query.length; i++) {
          const group = words.slice(i, i + query.length);
          if (
            group.every(
              (w, j) =>
                w.confidence >= b.confidence &&
                w.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") ===
                  query[j].replace(/[^\p{L}\p{N}]/gu, ""),
            )
          ) {
            const x0 = Math.min(...group.map((w) => w.bbox.x0)),
              y0 = Math.min(...group.map((w) => w.bbox.y0)),
              x1 = Math.max(...group.map((w) => w.bbox.x1)),
              y1 = Math.max(...group.map((w) => w.bbox.y1));
            return {
              x: Math.round((x0 + x1) / 2),
              y: Math.round((y0 + y1) / 2),
            };
          }
        }
      }
      return null;
    }
    const img = await pixels(frame.data);
    if (signal.aborted) throw new Error("Stopped");
    const d = img.data;
    const rgb = [1, 3, 5].map((i) => parseInt(b.color.slice(i, i + 2), 16));
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        if (rgb.every((v, c) => Math.abs(d[i + c] - v) <= b.tolerance))
          return { x, y };
      }
    return null;
  }
  async dispose() {
    this.templates.clear();
    if (this.workerPromise) {
      const worker = await this.workerPromise.catch(() => null);
      await worker?.terminate();
      this.workerPromise = null;
    }
  }
}
