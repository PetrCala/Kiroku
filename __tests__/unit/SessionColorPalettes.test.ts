import {
  CALENDAR_AF_STREAK_CAP,
  getCalendarAlcoholFreeTint,
} from '@libs/SessionColorPalettes';

describe('getCalendarAlcoholFreeTint', () => {
  test('a single alcohol-free day is a faint, non-solid tint of the swatch', () => {
    const tint = getCalendarAlcoholFreeTint('#008000', 1);
    // 8-digit hex: the swatch plus an alpha byte.
    expect(tint.color).toMatch(/^#008000[0-9a-f]{2}$/);
    expect(tint.isSolid).toBe(false);
  });

  test('the tint deepens along the run and saturates at the cap', () => {
    const alphaOf = (streak: number) =>
      parseInt(
        getCalendarAlcoholFreeTint('#008000', streak).color.slice(7),
        16,
      );
    expect(alphaOf(2)).toBeGreaterThan(alphaOf(1));
    expect(alphaOf(5)).toBeGreaterThan(alphaOf(4));
    // Near the end of the run the tile reads as filled: on-swatch text.
    expect(getCalendarAlcoholFreeTint('#008000', 6).isSolid).toBe(true);
    // At the cap the plain swatch comes back, and it stays there beyond it.
    expect(
      getCalendarAlcoholFreeTint('#008000', CALENDAR_AF_STREAK_CAP),
    ).toEqual({color: '#008000', isSolid: true});
    expect(getCalendarAlcoholFreeTint('#008000', 40)).toEqual({
      color: '#008000',
      isSolid: true,
    });
  });

  test('treats a position below 1 as the first day', () => {
    expect(getCalendarAlcoholFreeTint('#008000', 0)).toEqual(
      getCalendarAlcoholFreeTint('#008000', 1),
    );
  });

  test('falls back to the plain swatch for a non-hex color', () => {
    expect(getCalendarAlcoholFreeTint('green', 1)).toEqual({
      color: 'green',
      isSolid: true,
    });
  });
});
