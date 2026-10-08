import { test } from "node:test";
import assert from "node:assert/strict";
import {
  starters,
  validateMacro,
  parseMacro,
} from "../packages/shared/macros.js";
import { Runner } from "../packages/shared/runner.js";
import { matchTemplate } from "../apps/desktop/src/template-match.js";
import { checkPixel } from "../apps/desktop/src/pixel-check.js";
import { LocalAI, parseAction, parseDecision } from "../apps/desktop/src/local-ai.js";
test("math, comparisons and nested continue/break execute in the nearest loop", async () => {
  const events = [];
  const macro = { version: 1, name: "Count", vars: { counter: 0, limit: 5 }, blocks: [
    { type: "while", mode: "while", name: "counter", operator: "<", operand: "limit", body: [
      { type: "math", name: "counter", operator: "+", operand: "1" },
      { type: "ifCompare", name: "counter", operator: "==", operand: "2", then: [{ type: "continue" }], else: [] },
      { type: "ifCompare", name: "counter", operator: "==", operand: "4", then: [{ type: "break" }], else: [] },
      { type: "click", button: "left" },
    ] },
    { type: "setVar", name: "limit", value: "counter" },
  ] };
  validateMacro(macro);
  const runner = new Runner({ check: async () => {}, input: async (b) => events.push(b.type), release: async () => {} }, {}, () => {},
    { onVariable: (name, value) => events.push(`${name}:${value}`) });
  runner.wait = async () => {};
  await runner.run(macro);
  assert.deepEqual(events, ["counter:1", "click", "counter:2", "counter:3", "click", "counter:4", "limit:4"]);
  assert.equal(runner.vars.limit, 4);
});
test("until, division and arithmetic errors are bounded and release input", async () => {
  let released = 0;
  const bridge = { check: async () => {}, input: async () => {}, release: async () => { released++; } };
  const runner = new Runner(bridge, {});
  runner.wait = async () => {};
  const macro = { version: 1, name: "Until", vars: { count: 0 }, blocks: [
    { type: "while", mode: "until", name: "count", operator: ">=", operand: "3", body: [
      { type: "math", name: "count", operator: "+", operand: "1" },
    ] },
    { type: "math", name: "count", operator: "/", operand: "3" },
  ] };
  validateMacro(macro);
  await runner.run(macro);
  assert.equal(runner.vars.count, 1);
  assert.equal(released, 1);
  await assert.rejects(runner.run({ ...macro, blocks: [{ type: "math", name: "count", operator: "/", operand: "0" }] }), /Division by zero/);
  assert.equal(released, 2);
});
test("invalid variable references and loop control outside a loop are rejected", () => {
  const base = { version: 1, name: "Variables", vars: { count: 0 }, blocks: [] };
  for (const block of [
    { type: "math", name: "missing", operator: "+", operand: "1" },
    { type: "setVar", name: "count", value: "unknown" },
    { type: "break" }, { type: "continue" },
  ]) assert.throws(() => validateMacro({ ...base, blocks: [block] }));
  assert.throws(() => validateMacro({ ...base, vars: { "bad name": 0 } }));
});
test("pixel color check uses exact frame coordinates and tolerance", () => {
  const image = { width: 2, height: 2, data: new Uint8ClampedArray([
    0, 0, 0, 255, 10, 20, 30, 255,
    40, 50, 60, 255, 70, 80, 90, 255,
  ]) };
  assert.deepEqual(checkPixel(image, 1, 0, "#0a141e", 0), { x: 1, y: 0, confidence: 100 });
  assert.equal(checkPixel(image, 1, 0, "#0c141e", 1), null);
  assert.equal(checkPixel(image, 2, 0, "#000000", 80), null);
  const macro = { version: 1, name: "Pixel", blocks: [{ type: "checkPixel", x: 1, y: 0, color: "#0a141e", tolerance: 0, click: false }] };
  assert.equal(validateMacro(macro), macro);
});
test("starter files validate", () =>
  starters.forEach((s) => validateMacro(s.macro)));
test("reject executable fields, unknown operations, malformed nesting and values", () => {
  for (const blocks of [
    [{ type: "shell", command: "x" }],
    [{ type: "wait", ms: 10, jitter: 0, script: "x" }],
    [{ type: "loop", count: 1, body: null }],
    [{ type: "move", x: NaN, y: 0, relative: true }],
    [{ type: "click", button: "middle" }],
  ])
    assert.throws(() => validateMacro({ version: 1, name: "bad", blocks }));
  assert.throws(() => parseMacro("x".repeat(262145)));
});
test("nested loops preserve order and conditional state", async () => {
  const calls = [];
  const r = new Runner(
    {
      check: async () => {},
      input: async (b) => calls.push(b.type),
      release: async () => calls.push("release"),
    },
    { find: async () => null },
  );
  r.wait = async () => {};
  await r.run({
    blocks: [
      { type: "loop", count: 2, body: [{ type: "click", button: "left" }] },
      { type: "ifFound", then: [{ type: "click" }], else: [{ type: "move" }] },
    ],
  });
  assert.deepEqual(calls, ["click", "click", "move", "release"]);
});
test("cancellation always releases held input", async () => {
  let released = false;
  const r = new Runner(
    {
      check: async () => {
        r.stop();
      },
      release: async () => (released = true),
    },
    {},
  );
  await assert.rejects(r.run({ blocks: [{ type: "click" }] }));
  assert.equal(released, true);
});
test("vision click uses screen coordinates and sets conditional state", async () => {
  const calls = [];
  const r = new Runner(
    {
      check: async () => {},
      capture: async () => ({ x: 300, y: 200, data: "frame" }),
      input: async (b) => calls.push(b),
      release: async () => {},
    },
    { find: async () => ({ x: 40, y: 20 }) },
  );
  r.wait = async () => {};
  await r.run({
    blocks: [
      {
        type: "findText",
        text: "Skip",
        confidence: 80,
        interval: 500,
        timeout: 1000,
        click: true,
      },
      {
        type: "ifFound",
        then: [{ type: "key", key: "Space", holdMs: 10 }],
        else: [{ type: "click", button: "right" }],
      },
    ],
  });
  assert.deepEqual(calls[0], {
    type: "move",
    x: 340,
    y: 220,
    relative: false,
    screen: true,
  });
  assert.equal(calls[1].button, "left");
  assert.equal(calls[2].action, "down");
  assert.equal(calls[3].action, "up");
});
test("humanized movement preserves the exact intended endpoint", async () => {
  const calls = [];
  const r = new Runner(
    {
      check: async () => {},
      position: async () => ({ x: 100, y: 150 }),
      input: async (b) => calls.push(b),
      release: async () => {},
    },
    {},
    () => {},
    { humanize: true },
  );
  r.wait = async () => {};
  await r.run({ blocks: [{ type: "move", x: 20, y: -30, relative: true }] });
  assert.ok(calls.length >= 8);
  assert.deepEqual(calls.at(-1), {
    type: "move",
    x: 120,
    y: 120,
    relative: false,
    screen: false,
  });
});
test("new catalog starter uses valid key chords", () => {
  assert.equal(starters.length, 5);
  assert.equal(starters.find((s) => s.id === "da-hood-mobility").macro.blocks[0].body[0].keys, "w+Shift");
  assert.throws(() => validateMacro({ version: 1, name: "Bad chord", blocks: [{ type: "keyChord", keys: "a+;", holdMs: 50 }] }));
});
test("AI decisions and suggested actions reject malformed or out-of-frame output", () => {
  assert.equal(parseDecision('{"answer":true}'), true);
  assert.throws(() => parseDecision('{"answer":"true"}'));
  assert.deepEqual(parseAction('{"action":"click","x":3,"y":4}', { width: 10, height: 10 }), { action: "click", x: 3, y: 4 });
  for (const value of ['{"action":"shell","command":"dir"}', '{"action":"click","x":11,"y":1}', '{"action":"key","key":"F7"}', '{"action":"scroll","amount":100}'])
    assert.throws(() => parseAction(value, { width: 10, height: 10 }));
});
test("AI if/else and bounded navigation use the focus-checked bridge and unload", async () => {
  const calls = [];
  const ai = { decide: async () => true, next: async () => ({ action: "done" }), unload: async () => calls.push("unload") };
  const runner = new Runner({ check: async () => calls.push("check"), capture: async () => ({ x: 0, y: 0, width: 100, height: 100, data: "png" }),
    input: async (b) => calls.push(b.type), release: async () => calls.push("release") }, {}, () => {}, { ai });
  runner.wait = async () => {};
  const macro = { version: 1, name: "AI", blocks: [{ type: "aiIf", prompt: "Is it visible?", then: [
    { type: "aiNavigate", goal: "Finish task", maxSteps: 2 },
  ], else: [{ type: "click", button: "left" }] }] };
  validateMacro(macro);
  await runner.run(macro);
  assert.equal(calls.includes("click"), false);
  assert.deepEqual(calls.slice(-2), ["release", "unload"]);
});
test("AI navigator halts at its step limit", async () => {
  let count = 0;
  const runner = new Runner({ check: async () => {}, capture: async () => ({ width: 10, height: 10, data: "png" }),
    input: async () => {}, release: async () => {} }, {}, () => {}, { ai: { next: async () => { count++; return { action: "scroll", amount: 1 }; }, unload: async () => {} } });
  runner.wait = async () => {};
  await assert.rejects(runner.run({ blocks: [{ type: "aiNavigate", goal: "Scroll", maxSteps: 2 }] }), /did not verify completion/);
  assert.equal(count, 2);
});
test("stopping an AI request releases the runner without waiting for inference", async () => {
  let began;
  const pending = new Promise((resolve) => { began = resolve; });
  const ai = new LocalAI({ prepare: async () => {}, generate: () => pending, unload: async () => {} });
  const runner = new Runner({ check: async () => {}, capture: async () => ({ width: 10, height: 10, data: "png" }),
    release: async () => {} }, {}, () => {}, { ai });
  runner.wait = async () => {};
  const running = runner.run({ blocks: [{ type: "aiIf", prompt: "Is it visible?", then: [], else: [] }] });
  await new Promise((resolve) => setTimeout(resolve, 5));
  runner.stop();
  await assert.rejects(running, /Stopped/);
  began({ text: '{"answer":true}' });
});
test("smooth movement interpolates and ends at the intended endpoint", async () => {
  const inputs = [];
  const runner = new Runner({ check: async () => {}, position: async () => ({ x: 10, y: 10 }), input: async (b) => inputs.push(b), release: async () => {} }, {});
  runner.wait = async () => {};
  await runner.run({ blocks: [{ type: "move", x: 30, y: 20, relative: false, smooth: true, durationMs: 200 }] });
  assert.ok(inputs.length > 8);
  assert.ok(inputs.some((point) => point.x > 10 && point.x < 30));
  assert.deepEqual([inputs.at(-1).x, inputs.at(-1).y], [30, 20]);
});
test("key chords press together and release in reverse order", async () => {
  const events = [];
  const runner = new Runner({ check: async () => {}, input: async (b) => events.push(`${b.key}:${b.action}`), release: async () => {} }, {});
  runner.wait = async () => {};
  await runner.run({ blocks: [{ type: "keyChord", keys: "w+Shift", holdMs: 100 }] });
  assert.deepEqual(events, ["w:down", "Shift:down", "Shift:up", "w:up"]);
});
test("image template matching returns the center and a measured confidence", async () => {
  const frame = { width: 9, height: 9, data: new Uint8ClampedArray(9 * 9 * 4) };
  const template = { width: 2, height: 2, data: new Uint8ClampedArray(2 * 2 * 4) };
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const p = (y * 2 + x) * 4, q = ((y + 4) * 9 + x + 3) * 4;
    template.data.set([230, 30 + x * 40, 70 + y * 50, 255], p);
    frame.data.set([230, 30 + x * 40, 70 + y * 50, 255], q);
  }
  const match = await matchTemplate(frame, template, 99, new AbortController().signal);
  assert.deepEqual(match, { x: 4, y: 5, confidence: 100 });
  await assert.rejects(matchTemplate(frame, template, 99, AbortSignal.abort()), /Stopped/);
});
test("stop during vision prevents any subsequent click", async () => {
  const calls = [];
  const r = new Runner(
    {
      check: async () => {},
      capture: async () => ({ x: 0, y: 0 }),
      input: async (b) => calls.push(b),
      release: async () => {},
    },
    {
      find: async () => {
        r.stop();
        return { x: 5, y: 5 };
      },
    },
  );
  r.wait = async () => {};
  await assert.rejects(
    r.run({
      blocks: [
        {
          type: "findText",
          text: "Skip",
          confidence: 80,
          interval: 500,
          timeout: 1000,
          click: true,
        },
      ],
    }),
  );
  assert.equal(calls.length, 0);
});
test("text blocks validate and stop before typing when focus check fails", async () => {
  const macro = { version: 1, name: "Type a note", blocks: [{ type: "text", value: "Hello, world!" }] };
  assert.equal(validateMacro(macro), macro);
  assert.throws(() => validateMacro({ ...macro, blocks: [{ type: "text", value: "bad\0input" }] }));
  const calls = [];
  const runner = new Runner({
    check: async () => { throw new Error("Target lost focus"); },
    input: async (event) => calls.push(event),
    release: async () => calls.push("released"),
  }, {});
  await assert.rejects(runner.run(macro), /Target lost focus/);
  assert.deepEqual(calls, ["released"]);
});
