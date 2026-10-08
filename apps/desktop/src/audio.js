export class AudioFeedback {
  constructor() {
    this.context = null;
    this.enabled = true;
    this.lastTick = 0;
  }
  activate() {
    if (!this.enabled) return;
    this.context ??= new (window.AudioContext || window.webkitAudioContext)();
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
  }
  note(frequency, delay, duration, volume, shape = "sine") {
    const context = this.context;
    if (!context || context.state !== "running") return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  play(event) {
    if (!this.enabled || !this.context) return;
    if (event === "tick") {
      if (performance.now() - this.lastTick < 170) return;
      this.lastTick = performance.now();
      this.note(410, 0, 0.06, 0.018, "triangle");
    } else if (event === "success") {
      this.note(523.25, 0, 0.14, 0.04);
      this.note(783.99, 0.095, 0.22, 0.035);
    } else if (event === "error") {
      this.note(350, 0, 0.14, 0.035, "triangle");
      this.note(240, 0.13, 0.25, 0.03, "triangle");
    }
  }
  dispose() { this.context?.close().catch(() => {}); this.context = null; }
}
