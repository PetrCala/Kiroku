import type {DrinkKey} from '@src/types/onyx/Drinks';

/**
 * Herfindahl–Hirschman Index over drink-type shares: `Σ(units_i / total)²`.
 * 1/n for an even split across n keys; 1 when a single key holds everything.
 * Returns `NaN` for an empty or all-zero input — callers decide what to render.
 */
function computeHhi(unitsByDrinkKey: ReadonlyMap<DrinkKey, number>): number {
  let total = 0;
  for (const units of unitsByDrinkKey.values()) {
    if (units > 0) {
      total += units;
    }
  }
  if (total === 0) {
    return Number.NaN;
  }
  let hhi = 0;
  for (const units of unitsByDrinkKey.values()) {
    if (units > 0) {
      const share = units / total;
      hhi += share * share;
    }
  }
  return hhi;
}

type ConcentrationVerdict = 'moreVaried' | 'moreFocused' | 'aboutTheSame';

/**
 * Compare two HHI values within a dead-band. HHI ↑ = more focused (one type
 * dominating); HHI ↓ = more varied. NaN inputs collapse to `aboutTheSame`
 * so the rendered copy stays neutral when either window is empty.
 */
function compareConcentration(
  current: number,
  prior: number,
  deadBand = 0.05,
): ConcentrationVerdict {
  if (!Number.isFinite(current) || !Number.isFinite(prior)) {
    return 'aboutTheSame';
  }
  const delta = current - prior;
  if (delta > deadBand) {
    return 'moreFocused';
  }
  if (delta < -deadBand) {
    return 'moreVaried';
  }
  return 'aboutTheSame';
}

export {computeHhi, compareConcentration};
export type {ConcentrationVerdict};
