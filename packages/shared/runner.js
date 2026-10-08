// Interpreter accepts a narrow input bridge. No eval, scripts, commands or hooks.
export class Runner {
  constructor(bridge, vision, onStep = () => {}, options = {}) {
    this.options = options;
    this.bridge = bridge;
    this.vision = vision;
    this.onStep = onStep;
    this.running = false;
    this.found = false;
    this.controller = null;
  }
  stop() {
    this.running = false;
    this.controller?.abort();
  }
  async check() {
    if (!this.running) throw new Error("Stopped");
    await this.bridge.check();
  }
  async wait(ms) {
    const end = Date.now() + ms;
    do {
      await this.check();
      await new Promise((r) =>
        setTimeout(r, Math.min(25, Math.max(0, end - Date.now()))),
      );
    } while (Date.now() < end);
  }
  async run(m) {
    if (this.running) throw new Error("Already running");
    this.running = true;
    this.found = false;
    this.controller = new AbortController();
    try {
      await this.wait(3000);
      await this.blocks(m.blocks);
    } finally {
      this.stop();
      await this.bridge.release();
    }
  }
  async move(b) {
    if ((!b.smooth && !this.options.humanize) || !this.bridge.position) {
      const { smooth, durationMs, ...event } = b;
      await this.bridge.input(event);
      return;
    }
    const start = await this.bridge.position(Boolean(b.screen));
    const end = b.relative ? { x: start.x + b.x, y: start.y + b.y } : b;
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const duration = Math.max(40, Math.min(10000, b.durationMs ?? 130)) *
      (this.options.humanize ? 0.9 + Math.random() * 0.2 : 1);
    const steps = Math.max(8, Math.min(240, Math.ceil(duration / 16), Math.ceil(distance / 2)));
    const bend = this.options.humanize ? (Math.random() * 2 - 1) * Math.min(3, distance * 0.05) : 0;
    const nx = distance ? -(end.y - start.y) / distance : 0;
    const ny = distance ? (end.x - start.x) / distance : 0;
    for (let i = 1; i <= steps; i++) {
      await this.check();
      const t = i / steps;
      const eased = t * t * (3 - 2 * t);
      const deviation = i === steps ? 0 : Math.sin(t * Math.PI) * bend +
        (this.options.humanize ? (Math.random() - 0.5) * 0.9 : 0);
      await this.bridge.input({
        type: "move",
        x: Math.round(start.x + (end.x - start.x) * eased + nx * deviation),
        y: Math.round(start.y + (end.y - start.y) * eased + ny * deviation),
        relative: false,
        screen: Boolean(b.screen),
      });
      if (i < steps) await this.wait(duration / steps);
    }
  }
  async blocks(blocks) {
    for (const b of blocks) {
      await this.check();
      this.onStep(b.type);
      switch (b.type) {
        case "wait":
          await this.wait(
            Math.max(
              10,
              b.ms +
                (Math.random() * 2 - 1) *
                  (b.jitter + (this.options.humanize ? b.ms * 0.1 : 0)),
            ),
          );
          break;
        case "move":
          await this.move(b);
          await this.wait(10);
          break;
        case "click":
          await this.bridge.input(b);
          await this.wait(10);
          break;
        case "key":
          try {
            await this.bridge.input({ ...b, action: "down" });
            await this.wait(b.holdMs);
          } finally {
            await this.bridge.input({ ...b, action: "up" }).catch(() => {});
          }
          break;
        case "keyChord": {
          const held = [];
          try {
            for (const key of b.keys.split("+")) {
              await this.check();
              await this.bridge.input({ type: "key", key, action: "down", holdMs: b.holdMs });
              held.push(key);
            }
            await this.wait(b.holdMs);
          } finally {
            for (const key of held.reverse())
              await this.bridge.input({ type: "key", key, action: "up", holdMs: 0 }).catch(() => {});
          }
          break;
        }
        case "text":
          await this.bridge.input(b);
          break;
        case "drag":
          try {
            await this.move({ type: "move", x: b.x, y: b.y, relative: false, smooth: true, durationMs: 200 });
            await this.bridge.input({
              type: "button",
              button: "left",
              action: "down",
            });
            const steps = Math.ceil(b.duration / 16);
            for (let i = 1; i <= steps; i++) {
              await this.check();
              const t = i / steps, eased = t * t * (3 - 2 * t);
              await this.bridge.input({
                type: "move",
                x: Math.round(b.x + (b.toX - b.x) * eased),
                y: Math.round(b.y + (b.toY - b.y) * eased),
                relative: false,
              });
              await this.wait(b.duration / steps);
            }
          } finally {
            await this.bridge
              .input({ type: "button", button: "left", action: "up" })
              .catch(() => {});
          }
          break;
        case "loop":
          for (let i = 0; b.count === 0 || i < b.count; i++) {
            await this.blocks(b.body);
            await this.wait(10);
          }
          break;
        case "ifFound":
          await this.blocks(this.found ? b.then : b.else);
          break;
        case "findText":
        case "findColor":
        case "findImage": {
          if (b.type === "findImage" && !b.template) throw new Error("Upload an image template before running this block");
          this.found = false;
          const end = Date.now() + b.timeout;
          do {
            await this.check();
            const frame = await this.bridge.capture();
            const hit = await this.vision.find(
              frame,
              b,
              this.controller.signal,
            );
            await this.check();
            if (hit) {
              this.found = true;
              this.options.onMatch?.(b.type, hit);
              if (b.click) {
                await this.move({
                  type: "move", smooth: true, durationMs: 200,
                  x: frame.x + hit.x,
                  y: frame.y + hit.y,
                  relative: false,
                  screen: true,
                });
                await this.bridge.input({ type: "click", button: "left" });
              }
              break;
            }
            if (Date.now() < end) await this.wait(b.interval);
          } while (Date.now() < end);
          break;
        }
      }
    }
  }
}
