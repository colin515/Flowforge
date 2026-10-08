import { mkdir, cp, readdir } from "node:fs/promises";
import { resolve } from "node:path";
const dest = resolve("apps/desktop/public/ocr");
await mkdir(dest + "/core", { recursive: true });
await cp(
  "node_modules/tesseract.js/dist/worker.min.js",
  dest + "/worker.min.js",
);
for (const name of await readdir("node_modules/tesseract.js-core"))
  if (name.endsWith(".wasm") || name.endsWith(".wasm.js"))
    await cp("node_modules/tesseract.js-core/" + name, dest + "/core/" + name);
console.log(
  "Local OCR worker and WASM assets prepared. Language data is downloaded on first OCR use.",
);
