import { parseMacro } from "../../../packages/shared/macros.js";

const ACTIONS = new Set(["click", "type", "key", "scroll", "done", "fail"]);
const KEY = /^(Space|Enter|Tab|Escape|Shift|Control|Alt|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|[a-zA-Z0-9])$/;
function decoded(text) {
  // Small local models occasionally wrap strict JSON in Markdown or a thinking tag.
  const trimmed = String(text).replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = trimmed.match(/^\x60\x60\x60(?:json)?\s*([\s\S]*?)\s*\x60\x60\x60$/i);
  const result = JSON.parse(fenced ? fenced[1] : trimmed);
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Local AI returned an invalid object");
  return result;
}
export function parseDecision(text) {
  const result = decoded(text);
  if (Object.keys(result).length !== 1 || typeof result.answer !== "boolean")
    throw new Error("Local AI did not return a strict true/false decision");
  return result.answer;
}
export function parseAction(text, frame) {
  const value = decoded(text);
  if (!ACTIONS.has(value.action)) throw new Error("Local AI proposed an unsupported action");
  if (value.action === "click" && (!Number.isInteger(value.x) || !Number.isInteger(value.y) ||
    value.x < 0 || value.y < 0 || value.x >= frame.width || value.y >= frame.height))
    throw new Error("Local AI click is outside the captured window");
  if (value.action === "type" && (typeof value.text !== "string" || !value.text.length || value.text.length > 1000 || value.text.includes("\0")))
    throw new Error("Local AI returned invalid text input");
  if (value.action === "key" && !KEY.test(value.key)) throw new Error("Local AI returned an unsupported key");
  if (value.action === "scroll" && (!Number.isInteger(value.amount) || value.amount < -3 || value.amount > 3))
    throw new Error("Local AI scroll amount is out of bounds");
  if (value.action === "fail" && typeof value.reason !== "string") throw new Error("Local AI did not explain the failure");
  return value;
}
export class LocalAI {
  constructor(bridge, onStatus = () => {}) { this.bridge = bridge; this.onStatus = onStatus; this.ready = false; this.abort = new AbortController(); }
  cancel() { this.abort.abort(); }
  async interruptible(promise) {
    if (this.abort.signal.aborted) throw new Error("Stopped");
    return new Promise((resolve, reject) => {
      const onStop = () => reject(new Error("Stopped"));
      this.abort.signal.addEventListener("abort", onStop, { once: true });
      Promise.resolve(promise).then(resolve, reject).finally(() => this.abort.signal.removeEventListener("abort", onStop));
    });
  }
  async prepare() {
    if (this.ready) return;
    this.onStatus("Checking local AI model · Ollama must be running");
    await this.interruptible(this.bridge.prepare());
    this.ready = true;
    this.onStatus("Local AI model ready");
  }
  async compactImage(image) {
    if (!image || !image.startsWith("data:image/png;base64,")) return image;
    const source = new Image();
    source.src = image;
    await source.decode();
    const largest = Math.max(source.width, source.height);
    if (largest <= 1024) return image;
    const scale = 1024 / largest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  }
  async ask(prompt, image, maxTokens = 256) {
    await this.prepare();
    const compactImage = await this.compactImage(image);
    const { text } = await this.interruptible(this.bridge.generate({ prompt, image: compactImage, maxTokens }));
    return text;
  }
  async decide(goal, frame) {
    const prompt = `Look at the screenshot and answer this question: ${goal}\nReturn ONLY a JSON object {"answer":true} or {"answer":false}. If uncertain, answer false.`;
    return parseDecision(await this.ask(prompt, frame.data, 64));
  }
  async next(goal, frame, history) {
    // Coordinates must match the image actually sent to the vision model,
    // not the full-resolution native screenshot.
    const image = await this.compactImage(frame.data);
    const scale = Math.min(1, 1024 / Math.max(frame.width, frame.height));
    const shown = {
      width: Math.max(1, Math.round(frame.width * scale)),
      height: Math.max(1, Math.round(frame.height * scale)),
    };
    const prompt = `You control only the selected application's visible window. Goal: ${goal}\nThe attached screenshot is ${shown.width} pixels wide and ${shown.height} pixels high. Coordinates start at the top-left (0,0). Previous actions: ${history.join("; ") || "none"}. Choose exactly ONE useful next action. Return ONLY JSON: {"action":"click","x":10,"y":20} with coordinates in THIS IMAGE; or {"action":"type","text":"..."}; or {"action":"key","key":"Enter"}; or {"action":"scroll","amount":1}; or {"action":"done"} ONLY when the screenshot proves the goal is complete; or {"action":"fail","reason":"..."} if impossible. Prefer actionable clicks over announcing intentions. Never request commands, scripts, files or clicks outside this image.`;
    const action = parseAction(await this.ask(prompt, image, 200), shown);
    if (action.action !== "click") return action;
    return {
      ...action,
      x: Math.min(frame.width - 1, Math.max(0, Math.round(action.x * frame.width / shown.width))),
      y: Math.min(frame.height - 1, Math.max(0, Math.round(action.y * frame.height / shown.height))),
    };
  }
  async generateMacro(goal) {
    const prompt = `Generate one safe visual macro for this task: ${goal}\nReturn ONLY a JSON object with exactly {"version":1,"name":"...","blocks":[...]}. Allowed blocks: {"type":"wait","ms":500,"jitter":0}, {"type":"click","button":"left"}, {"type":"move","x":10,"y":10,"relative":false,"smooth":true,"durationMs":300}, {"type":"key","key":"Enter","holdMs":50}, {"type":"text","value":"example"}, {"type":"loop","count":2,"body":[...]}, {"type":"findText","text":"Skip","confidence":80,"interval":500,"timeout":5000,"click":false}, {"type":"ifFound","then":[],"else":[]}, {"type":"aiNavigate","goal":"...","maxSteps":8}, {"type":"aiIf","prompt":"...","then":[],"else":[]}. Use at most twelve blocks, loops finite unless the user expressly requests indefinite repetition. Do not include executable code or any other fields.`;
    const result = await this.ask(prompt, null, 1024);
    return parseMacro(result);
  }
  async unload() {
    if (!this.ready) return;
    this.ready = false;
    await this.bridge.unload();
  }
}
