export const defaults = {
  wait: { type: "wait", ms: 500, jitter: 0 },
  move: { type: "move", x: 4, y: 0, relative: true },
  click: { type: "click", button: "left" },
  key: { type: "key", key: "Space", holdMs: 50 },
  text: { type: "text", value: "Hello, world!" },
  drag: { type: "drag", x: 200, y: 200, toX: 400, toY: 200, duration: 500 },
  findText: {
    type: "findText",
    text: "Skip",
    confidence: 80,
    interval: 500,
    timeout: 10000,
    click: true,
  },
  findColor: {
    type: "findColor",
    color: "#ffffff",
    tolerance: 12,
    interval: 500,
    timeout: 5000,
    click: false,
  },
  loop: { type: "loop", count: 10, body: [] },
  ifFound: { type: "ifFound", then: [], else: [] },
};
export const starters = [
  {
    id: "roblox-afk",
    name: "Default Roblox Anti-AFK",
    locked: true,
    description:
      "Small relative movements with configurable randomized waits. Keep the selected window in the foreground.",
    icon: "orbit",
    category: "Utility",
    macro: {
      version: 1,
      name: "Default Roblox Anti-AFK",
      blocks: [
        {
          type: "loop",
          count: 0,
          body: [
            { type: "wait", ms: 45000, jitter: 15000 },
            { type: "move", x: 3, y: 0, relative: true },
            { type: "wait", ms: 120, jitter: 30 },
            { type: "move", x: -3, y: 0, relative: true },
          ],
        },
      ],
    },
  },
  {
    id: "auto-clicker",
    name: "Auto-Clicker",
    locked: false,
    description:
      "A focused clicker. Pick a button, set your interval, and press play.",
    icon: "pointer",
    category: "Productivity",
    macro: {
      version: 1,
      name: "Auto-Clicker",
      blocks: [
        {
          type: "loop",
          count: 0,
          body: [
            { type: "click", button: "left" },
            { type: "wait", ms: 100, jitter: 0 },
          ],
        },
      ],
    },
  },
  {
    id: "ad-skipper",
    name: "Smart Ad Skipper",
    locked: false,
    description:
      "Find visible “Skip” text with OCR and click the match. Review the text and confidence before use.",
    icon: "scan",
    category: "Vision",
    macro: {
      version: 1,
      name: "Smart Ad Skipper",
      blocks: [
        {
          type: "loop",
          count: 0,
          body: [
            {
              type: "findText",
              text: "Skip",
              confidence: 85,
              interval: 500,
              timeout: 10000,
              click: true,
            },
            { type: "wait", ms: 2000, jitter: 0 },
          ],
        },
      ],
    },
  },
];
const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);
export function validateMacro(m) {
  let nodes = 0;
  const fail = (message) => {
    throw new Error(message);
  };
  const num = (v, min, max, label) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
      fail(`Invalid ${label}: ${min}–${max}`);
  };
  const keys = (o, allowed) => {
    for (const k of Object.keys(o))
      if (!allowed.includes(k)) fail(`Unsupported field: ${k}`);
  };
  if (!isObject(m)) fail("Expected a macro object");
  keys(m, ["version", "name", "blocks"]);
  if (
    m.version !== 1 ||
    typeof m.name !== "string" ||
    !m.name.trim() ||
    m.name.length > 100
  )
    fail("Invalid macro name or version");
  const walk = (blocks, depth) => {
    if (depth > 8 || !Array.isArray(blocks)) fail("Invalid block nesting");
    for (const b of blocks) {
      if (++nodes > 500 || !isObject(b) || !Object.hasOwn(defaults, b.type))
        fail("Unknown block or too many blocks");
      keys(b, Object.keys(defaults[b.type]));
      for (const k of Object.keys(defaults[b.type]))
        if (!(k in b)) fail(`Missing ${k}`);
      switch (b.type) {
        case "wait":
          num(b.ms, 10, 3600000, "wait");
          num(b.jitter, 0, b.ms - 1, "jitter");
          break;
        case "move":
          if (!Number.isInteger(b.x) || !Number.isInteger(b.y))
            fail("Coordinates must be integers");
          num(b.x, -32768, 32768, "x");
          num(b.y, -32768, 32768, "y");
          if (typeof b.relative !== "boolean") fail("relative must be boolean");
          break;
        case "click":
          if (!["left", "right"].includes(b.button)) fail("Invalid button");
          break;
        case "key":
          if (
            !/^(Space|Enter|Tab|Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|[a-zA-Z0-9])$/.test(
              b.key,
            )
          )
            fail("Unsupported key");
          num(b.holdMs, 0, 5000, "hold");
          if (!Number.isInteger(b.holdMs)) fail("Hold must be an integer");
          break;
        case "text":
          if (typeof b.value !== "string" || !b.value.length || b.value.length > 1000 || b.value.includes("\0"))
            fail("Text must contain 1–1000 characters without NUL bytes");
          break;
        case "drag":
          for (const k of ["x", "y", "toX", "toY"]) {
            num(b[k], -32768, 32768, k);
            if (!Number.isInteger(b[k])) fail("Coordinates must be integers");
          }
          num(b.duration, 100, 10000, "duration");
          break;
        case "findText":
          if (
            typeof b.text !== "string" ||
            !b.text.trim() ||
            b.text.length > 100
          )
            fail("Invalid search text");
          num(b.confidence, 0, 100, "confidence"); // fall through
        case "findColor":
          if (b.type === "findColor") {
            if (!/^#[0-9a-f]{6}$/i.test(b.color)) fail("Invalid color");
            num(b.tolerance, 0, 80, "tolerance");
          }
          num(b.interval, 100, 10000, "scan interval");
          num(b.timeout, 100, 60000, "timeout");
          if (typeof b.click !== "boolean") fail("click must be boolean");
          break;
        case "loop":
          num(b.count, 0, 100000, "repeat");
          if (!Number.isInteger(b.count)) fail("Repeat must be an integer");
          walk(b.body, depth + 1);
          break;
        case "ifFound":
          walk(b.then, depth + 1);
          walk(b.else, depth + 1);
          break;
      }
    }
  };
  walk(m.blocks, 0);
  return m;
}
export function parseMacro(text) {
  if (text.length > 262144) throw new Error("Maximum file size is 256 KB");
  return validateMacro(JSON.parse(text));
}
export function downloadJSON(m) {
  validateMacro(m);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(m, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = m.name.replace(/[^a-z0-9_-]/gi, "-") + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const clone = (v) => JSON.parse(JSON.stringify(v));
