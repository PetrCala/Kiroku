import percentile from '@libs/Statistics/stats/percentile';

type Band = {p25: number; p75: number};

/**
 * "Band of normal" — P25/P75 over the last `window` (default 12) entries.
 * Returns `null` for `series.length < 4` since the percentile would be
 * mostly noise; callers (TrendLine) interpret null as "do not render".
 */
function percentileBand(series: number[], window = 12): Band | null {
  if (series.length < 4) {
    return null;
  }
  const slice = series.slice(-Math.min(window, series.length));
  const p25 = percentile(slice, 0.25);
  const p75 = percentile(slice, 0.75);
  return {p25, p75};
}

export default percentileBand;
export type {Band};
