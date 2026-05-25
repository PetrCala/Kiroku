import {compareConcentration, computeHhi} from '@libs/Statistics/herfindahl';
import type {DrinkKey} from '@src/types/onyx/Drinks';

function mapOf(entries: Array<[DrinkKey, number]>): Map<DrinkKey, number> {
  return new Map(entries);
}

describe('computeHhi', () => {
  it('returns NaN for empty input', () => {
    expect(computeHhi(new Map())).toBeNaN();
  });

  it('returns NaN when every key holds zero units', () => {
    expect(
      computeHhi(
        mapOf([
          ['beer', 0],
          ['wine', 0],
        ]),
      ),
    ).toBeNaN();
  });

  it('returns 1 for a single-type window', () => {
    expect(computeHhi(mapOf([['beer', 12]]))).toBe(1);
  });

  it('returns 1/n for an even split', () => {
    const result = computeHhi(
      mapOf([
        ['beer', 4],
        ['wine', 4],
        ['cocktail', 4],
        ['other', 4],
      ]),
    );
    expect(result).toBeCloseTo(0.25, 10);
  });

  it('matches Σ(share²) for an uneven split', () => {
    // 6/10, 3/10, 1/10 → 0.36 + 0.09 + 0.01 = 0.46
    const result = computeHhi(
      mapOf([
        ['beer', 6],
        ['wine', 3],
        ['cocktail', 1],
      ]),
    );
    expect(result).toBeCloseTo(0.46, 10);
  });

  it('ignores zero-unit keys without throwing', () => {
    const result = computeHhi(
      mapOf([
        ['beer', 6],
        ['wine', 0],
        ['cocktail', 4],
      ]),
    );
    // 6/10, 4/10 → 0.36 + 0.16 = 0.52
    expect(result).toBeCloseTo(0.52, 10);
  });
});

describe('compareConcentration', () => {
  it('returns moreFocused when current rises above the dead-band', () => {
    expect(compareConcentration(0.6, 0.5, 0.05)).toBe('moreFocused');
  });

  it('returns moreVaried when current drops below the dead-band', () => {
    expect(compareConcentration(0.4, 0.5, 0.05)).toBe('moreVaried');
  });

  it('returns aboutTheSame inside the dead-band', () => {
    expect(compareConcentration(0.54, 0.5, 0.05)).toBe('aboutTheSame');
    expect(compareConcentration(0.5, 0.5, 0.05)).toBe('aboutTheSame');
    expect(compareConcentration(0.46, 0.5, 0.05)).toBe('aboutTheSame');
  });

  it('collapses NaN inputs to aboutTheSame', () => {
    expect(compareConcentration(Number.NaN, 0.5)).toBe('aboutTheSame');
    expect(compareConcentration(0.5, Number.NaN)).toBe('aboutTheSame');
    expect(compareConcentration(Number.NaN, Number.NaN)).toBe('aboutTheSame');
  });

  it('defaults the dead-band to 0.05', () => {
    expect(compareConcentration(0.6, 0.5)).toBe('moreFocused');
    expect(compareConcentration(0.54, 0.5)).toBe('aboutTheSame');
  });
});
