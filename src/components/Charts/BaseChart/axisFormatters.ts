/** Round a numeric axis tick to a whole number. */
function roundTick(value: number): string {
  return String(Math.round(value));
}

/**
 * Up to `count` evenly-spaced integer indices across `[0, length-1]`. Used as
 * explicit x-axis `tickValues` for index-based charts so victory places labels
 * on real data points (integers) rather than interpolated fractions.
 */
function tickIndices(length: number, count = 5): number[] {
  if (length <= 0) {
    return [];
  }
  if (length <= count) {
    return Array.from({length}, (_, i) => i);
  }
  const step = (length - 1) / (count - 1);
  const indices: number[] = [];
  for (let i = 0; i < count; i += 1) {
    indices.push(Math.round(i * step));
  }
  return Array.from(new Set(indices));
}

/** Up to `count` rounded value ticks across `[0, max]` (deduped). */
function valueTicks(max: number, count = 4): number[] {
  if (max <= 0) {
    return [0];
  }
  const step = max / (count - 1);
  const ticks: number[] = [];
  for (let i = 0; i < count; i += 1) {
    ticks.push(Math.round(i * step));
  }
  return Array.from(new Set(ticks));
}

export {roundTick, tickIndices, valueTicks};
