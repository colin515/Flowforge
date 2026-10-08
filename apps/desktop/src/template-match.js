// Pixel template matching with a sparse search and exact verification.
// Transparent template pixels are ignored; confidence is a normalized RGB similarity.
export async function matchTemplate(frame, template, threshold, signal) {
  const { width: fw, height: fh, data: pixels } = frame;
  const { width: tw, height: th, data: pattern } = template;
  if (tw > fw || th > fh || !tw || !th) return null;
  const samples = [];
  const stride = Math.max(1, Math.floor(Math.sqrt(tw * th / 64)));
  for (let y = 0; y < th; y += stride) for (let x = 0; x < tw; x += stride) {
    const offset = (y * tw + x) * 4;
    if (pattern[offset + 3] >= 128) samples.push([x, y, offset]);
  }
  if (!samples.length) return null;
  const maxError = samples.length * 765 * (1 - threshold / 100);
  let best = null;
  const candidates = [];
  const test = (x, y) => {
    let error = 0;
    for (const [dx, dy, p] of samples) {
      const i = ((y + dy) * fw + x + dx) * 4;
      error += Math.abs(pixels[i] - pattern[p]) + Math.abs(pixels[i + 1] - pattern[p + 1]) + Math.abs(pixels[i + 2] - pattern[p + 2]);
      if (error > maxError) return 0;
    }
    return 100 * (1 - error / (samples.length * 765));
  };
  const verify = (x, y) => {
    let error = 0, count = 0;
    for (let dy = 0; dy < th; dy++) for (let dx = 0; dx < tw; dx++) {
      const p = (dy * tw + dx) * 4;
      if (pattern[p + 3] < 128) continue;
      const i = ((y + dy) * fw + x + dx) * 4;
      error += Math.abs(pixels[i] - pattern[p]) + Math.abs(pixels[i + 1] - pattern[p + 1]) + Math.abs(pixels[i + 2] - pattern[p + 2]);
      count++;
      if (error > count * 765 * (1 - threshold / 100) + (tw * th - count) * 765 * (1 - threshold / 100)) return 0;
    }
    return count ? 100 * (1 - error / (count * 765)) : 0;
  };
  for (let y = 0; y <= fh - th; y++) {
    if (signal.aborted) throw new Error("Stopped");
    for (let x = 0; x <= fw - tw; x++) {
      const confidence = test(x, y);
      if (confidence >= threshold) {
        if (candidates.length < 32) candidates.push({ x, y, confidence });
        else {
          let weakest = 0;
          for (let i = 1; i < candidates.length; i++) if (candidates[i].confidence < candidates[weakest].confidence) weakest = i;
          if (confidence > candidates[weakest].confidence) candidates[weakest] = { x, y, confidence };
        }
      }
    }
    if (y % 48 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  for (const candidate of candidates.slice(0, 32)) {
    for (let y = Math.max(0, candidate.y - 1); y <= Math.min(fh - th, candidate.y + 1); y++)
      for (let x = Math.max(0, candidate.x - 1); x <= Math.min(fw - tw, candidate.x + 1); x++) {
        if (signal.aborted) throw new Error("Stopped");
        const confidence = verify(x, y);
        if (confidence < threshold) continue;
        if (!best || confidence > best.confidence) best = { x, y, confidence };
      }
  }
  return best && { x: best.x + Math.floor(tw / 2), y: best.y + Math.floor(th / 2), confidence: Math.round(best.confidence * 10) / 10 };
}
