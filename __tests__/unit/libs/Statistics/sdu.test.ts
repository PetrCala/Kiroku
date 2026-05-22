import {gramsOfAlcohol, sduFrom} from '@libs/Statistics/sdu';

describe('gramsOfAlcohol', () => {
  it('returns ml * abv * 0.789 (ethanol density at 20°C)', () => {
    // 500ml of 5% beer → 19.725g ethanol
    expect(gramsOfAlcohol(500, 0.05)).toBeCloseTo(19.725, 3);
  });

  it('returns 0 when either input is 0', () => {
    expect(gramsOfAlcohol(0, 0.4)).toBe(0);
    expect(gramsOfAlcohol(40, 0)).toBe(0);
  });
});

describe('sduFrom', () => {
  it('defaults gramsPerUnit to the WHO standard (10g)', () => {
    // 330ml of 5% beer → ~13g ethanol → ~1.3 SDU
    expect(sduFrom(330, 0.05)).toBeCloseTo(1.302, 3);
  });

  it('respects an explicit gramsPerUnit override', () => {
    // 500ml of 12% wine at 14g/unit (UK standard)
    const sdus = sduFrom(500, 0.12, 14);
    expect(sdus).toBeCloseTo(gramsOfAlcohol(500, 0.12) / 14, 6);
  });
});
