export const defaults = {
  wait: { type: "wait", ms: 500, jitter: 0 },
  move: { type: "move", x: 4, y: 0, relative: true, smooth: true, durationMs: 350 },
  click: { type: "click", button: "left" },
  key: { type: "key", key: "Space", holdMs: 50 },
  keyChord: { type: "keyChord", keys: "w+Shift", holdMs: 180 },
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
  findImage: {
    type: "findImage", template: "", confidence: 85, interval: 500,
    timeout: 10000, click: true,
  },
  checkPixel: { type: "checkPixel", x: 0, y: 0, color: "#ffffff", tolerance: 12, click: false },
  loop: { type: "loop", count: 10, body: [] },
  while: { type: "while", name: "counter", operator: "<", operand: "10", mode: "while", body: [] },
  ifFound: { type: "ifFound", then: [], else: [] },
  ifCompare: { type: "ifCompare", name: "counter", operator: ">=", operand: "10", then: [], else: [] },
  setVar: { type: "setVar", name: "counter", value: "0" },
  math: { type: "math", name: "counter", operator: "+", operand: "1" },
  break: { type: "break" },
  continue: { type: "continue" },
  aiNavigate: { type: "aiNavigate", goal: "Find the sound settings and turn sound off", maxSteps: 8 },
  aiIf: { type: "aiIf", prompt: "Is the sound settings menu visible?", then: [], else: [] },
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
  {
    id: "da-hood-mobility",
    name: "Da Hood Mobility Flow",
    locked: false,
    description: "Configurable movement key chords and short bursts for Roblox Da Hood. Keep its window focused and review game rules.",
    icon: "pointer",
    category: "Gaming",
    macro: {
      version: 1,
      name: "Da Hood Mobility Flow",
      blocks: [{
        type: "loop", count: 0, body: [
          { type: "keyChord", keys: "w+Shift", holdMs: 180 },
          { type: "wait", ms: 80, jitter: 30 },
          { type: "keyChord", keys: "a+Shift", holdMs: 110 },
          { type: "keyChord", keys: "d+Shift", holdMs: 110 },
          { type: "wait", ms: 120, jitter: 40 },
        ],
      }],
    },
  },
  {
    id: "local-ai-suite",
    name: "Local AI Agent Suite",
    locked: false,
    description: "On-demand local vision agent with prompt-to-flow generation, screen decisions, and bounded navigation. Requires Ollama; model downloads on first use.",
    icon: "scan",
    category: "AI",
    macro: {
      version: 1,
      name: "Local AI Agent Suite",
      blocks: [{ type: "aiIf", prompt: "Is the sound settings menu visible?", then: [
        { type: "aiNavigate", goal: "Turn the sound off in this application's settings", maxSteps: 8 },
      ], else: [
        { type: "aiNavigate", goal: "Open sound settings and turn the sound off", maxSteps: 8 },
      ] }],
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
  keys(m, ["version", "name", "blocks", "vars"]);
  if (
    m.version !== 1 ||
    typeof m.name !== "string" ||
    !m.name.trim() ||
    m.name.length > 100
  )
    fail("Invalid macro name or version");
  const vars = m.vars ?? {};
  if (!isObject(vars) || Object.keys(vars).length > 32) fail("Invalid variable list");
  const variableName = (name) => typeof name === "string" && /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(name) && Object.hasOwn(vars, name);
  for (const [name, value] of Object.entries(vars)) {
    if (!variableName(name)) fail("Invalid variable name");
    num(value, -1000000000, 1000000000, name);
  }
  const operand = (value) => {
    if (typeof value !== "string" || !value.trim() || value.length > 40) fail("Invalid math operand");
    const numeric = Number(value);
    if (Number.isFinite(numeric)) num(numeric, -1000000000, 1000000000, "operand");
    else if (!variableName(value)) fail(`Unknown variable: ${value}`);
  };
  const comparison = (b) => {
    if (!variableName(b.name)) fail(`Unknown variable: ${b.name}`);
    if (!["==", "!=", "<", "<=", ">", ">="].includes(b.operator)) fail("Invalid comparison");
    operand(b.operand);
  };
  const walk = (blocks, depth, loopDepth = 0) => {
    if (depth > 8 || !Array.isArray(blocks)) fail("Invalid block nesting");
    for (const b of blocks) {
      if (++nodes > 500 || !isObject(b) || !Object.hasOwn(defaults, b.type))
        fail("Unknown block or too many blocks");
      keys(b, Object.keys(defaults[b.type]));
      for (const k of Object.keys(defaults[b.type]))
        if (!(k in b) && !(b.type === "move" && ["smooth", "durationMs"].includes(k))) fail(`Missing ${k}`);
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
          if (b.smooth !== undefined && typeof b.smooth !== "boolean") fail("smooth must be boolean");
          if (b.durationMs !== undefined) num(b.durationMs, 40, 10000, "movement duration");
          break;
        case "click":
          if (!["left", "right"].includes(b.button)) fail("Invalid button");
          break;
        case "key":
          if (
              !/^(Space|Enter|Tab|Escape|Shift|Control|Alt|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|[a-zA-Z0-9])$/.test(
              b.key,
            )
          )
            fail("Unsupported key");
          num(b.holdMs, 0, 5000, "hold");
          if (!Number.isInteger(b.holdMs)) fail("Hold must be an integer");
          break;
        case "keyChord": {
          if (typeof b.keys !== "string") fail("Invalid key chord");
          const parts = b.keys.split("+");
          if (parts.length < 2 || parts.length > 4 || new Set(parts).size !== parts.length ||
            parts.some((part) => !/^(Space|Enter|Tab|Escape|Shift|Control|Alt|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|[a-zA-Z0-9])$/.test(part))) fail("Invalid key chord");
          num(b.holdMs, 10, 5000, "chord hold");
          break;
        }
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
        case "findImage":
          if (typeof b.template !== "string" ||
            !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(b.template) || b.template.length > 200000)
            fail("Upload a PNG template under 150 KB");
          num(b.confidence, 0, 100, "confidence");
          num(b.interval, 100, 10000, "scan interval");
          num(b.timeout, 100, 60000, "timeout");
          if (typeof b.click !== "boolean") fail("click must be boolean");
          break;
        case "checkPixel":
          for (const axis of ["x", "y"]) {
            num(b[axis], 0, 32768, axis);
            if (!Number.isInteger(b[axis])) fail("Pixel coordinates must be integers");
          }
          if (!/^#[0-9a-f]{6}$/i.test(b.color)) fail("Invalid color");
          num(b.tolerance, 0, 80, "tolerance");
          if (typeof b.click !== "boolean") fail("click must be boolean");
          break;
        case "loop":
          num(b.count, 0, 100000, "repeat");
          if (!Number.isInteger(b.count)) fail("Repeat must be an integer");
          walk(b.body, depth + 1, loopDepth + 1);
          break;
        case "while":
          comparison(b);
          if (!["while", "until"].includes(b.mode)) fail("Invalid loop mode");
          walk(b.body, depth + 1, loopDepth + 1);
          break;
        case "ifFound":
          walk(b.then, depth + 1, loopDepth);
          walk(b.else, depth + 1, loopDepth);
          break;
        case "ifCompare":
          comparison(b);
          walk(b.then, depth + 1, loopDepth);
          walk(b.else, depth + 1, loopDepth);
          break;
        case "setVar":
          if (!variableName(b.name)) fail(`Unknown variable: ${b.name}`);
          operand(b.value);
          break;
        case "math":
          if (!variableName(b.name)) fail(`Unknown variable: ${b.name}`);
          if (!["+", "-", "*", "/"].includes(b.operator)) fail("Invalid math operation");
          operand(b.operand);
          break;
        case "break":
        case "continue":
          if (!loopDepth) fail(`${b.type} must be inside a loop`);
          break;
        case "aiNavigate":
          if (typeof b.goal !== "string" || !b.goal.trim() || b.goal.length > 500) fail("Invalid AI navigation goal");
          num(b.maxSteps, 1, 20, "AI steps");
          if (!Number.isInteger(b.maxSteps)) fail("AI steps must be an integer");
          break;
        case "aiIf":
          if (typeof b.prompt !== "string" || !b.prompt.trim() || b.prompt.length > 500) fail("Invalid AI question");
          walk(b.then, depth + 1, loopDepth);
          walk(b.else, depth + 1, loopDepth);
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
