export function checkPixel(image, x, y, color, tolerance) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return null;
  const index = (y * image.width + x) * 4;
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  return rgb.every((value, channel) => Math.abs(image.data[index + channel] - value) <= tolerance)
    ? { x, y, confidence: 100 } : null;
}
