import { test } from "node:test";
import assert from "node:assert/strict";
import {
  starters,
  validateMacro,
  parseMacro,
} from "../packages/shared/macros.js";
import { Runner } from "../packages/shared/runner.js";
import { matchTemplate } from "../apps/desktop/src/template-match.js";
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
  assert.equal(starters.length, 4);
  assert.equal(starters.find((s) => s.id === "da-hood-mobility").macro.blocks[0].body[0].keys, "w+Shift");
  assert.throws(() => validateMacro({ version: 1, name: "Bad chord", blocks: [{ type: "keyChord", keys: "a+;", holdMs: 50 }] }));
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
