import {
  hexToHsv,
  hexToRgb,
  hsvToHex,
  hsvToRgb,
  normalizeHex,
  rgbToHex,
  rgbToHsv,
} from '@libs/Color';
import type {Rgb} from '@libs/Color';

describe('Color', () => {
  describe('normalizeHex', () => {
    it('accepts a canonical 6-digit hex', () => {
      expect(normalizeHex('#1A2B3C')).toBe('#1A2B3C');
    });

    it('uppercases lowercase input', () => {
      expect(normalizeHex('#abcdef')).toBe('#ABCDEF');
    });

    it('adds a missing leading #', () => {
      expect(normalizeHex('abcdef')).toBe('#ABCDEF');
    });

    it('expands 3-digit shorthand', () => {
      expect(normalizeHex('#abc')).toBe('#AABBCC');
      expect(normalizeHex('f0a')).toBe('#FF00AA');
    });

    it('trims surrounding whitespace', () => {
      expect(normalizeHex('  #abc  ')).toBe('#AABBCC');
    });

    it('rejects invalid input', () => {
      expect(normalizeHex('')).toBeNull();
      expect(normalizeHex('#12')).toBeNull();
      expect(normalizeHex('#12345')).toBeNull();
      expect(normalizeHex('#1234567')).toBeNull();
      expect(normalizeHex('#ggg')).toBeNull();
      expect(normalizeHex('not a color')).toBeNull();
      expect(normalizeHex('#xyzxyz')).toBeNull();
    });
  });

  describe('hexToRgb / rgbToHex', () => {
    it('parses primary colors', () => {
      expect(hexToRgb('#FF0000')).toEqual({r: 255, g: 0, b: 0});
      expect(hexToRgb('#00FF00')).toEqual({r: 0, g: 255, b: 0});
      expect(hexToRgb('#0000FF')).toEqual({r: 0, g: 0, b: 255});
    });

    it('round-trips rgb -> hex -> rgb', () => {
      const rgb: Rgb = {r: 18, g: 52, b: 86};
      expect(hexToRgb(rgbToHex(rgb))).toEqual(rgb);
    });

    it('returns null for invalid hex', () => {
      expect(hexToRgb('nope')).toBeNull();
    });
  });

  describe('rgbToHsv / hsvToRgb', () => {
    it('maps pure red to hue 0', () => {
      expect(rgbToHsv({r: 255, g: 0, b: 0})).toEqual({h: 0, s: 1, v: 1});
    });

    it('maps pure green to hue 120', () => {
      expect(rgbToHsv({r: 0, g: 255, b: 0})).toEqual({h: 120, s: 1, v: 1});
    });

    it('maps pure blue to hue 240', () => {
      expect(rgbToHsv({r: 0, g: 0, b: 255})).toEqual({h: 240, s: 1, v: 1});
    });

    it('maps black and white to zero saturation', () => {
      expect(rgbToHsv({r: 0, g: 0, b: 0})).toEqual({h: 0, s: 0, v: 0});
      expect(rgbToHsv({r: 255, g: 255, b: 255})).toEqual({h: 0, s: 0, v: 1});
    });

    it('round-trips rgb -> hsv -> rgb', () => {
      const samples: Rgb[] = [
        {r: 255, g: 165, b: 0},
        {r: 17, g: 119, b: 51},
        {r: 200, g: 65, b: 43},
        {r: 110, g: 106, b: 134},
        {r: 12, g: 200, b: 255},
      ];
      samples.forEach(rgb => {
        expect(hsvToRgb(rgbToHsv(rgb))).toEqual(rgb);
      });
    });
  });

  describe('hexToHsv / hsvToHex', () => {
    it('round-trips hex -> hsv -> hex across the channel space', () => {
      for (let r = 0; r <= 255; r += 17) {
        for (let g = 0; g <= 255; g += 17) {
          for (let b = 0; b <= 255; b += 17) {
            const hex = rgbToHex({r, g, b});
            const hsv = hexToHsv(hex);
            if (!hsv) {
              throw new Error(`expected hsv for ${hex}`);
            }
            expect(hsvToHex(hsv)).toBe(hex);
          }
        }
      }
    });

    it('round-trips the bundled preset colors', () => {
      const presetHexes = [
        '#008000',
        '#FFFF00',
        '#FFA500',
        '#FF0000',
        '#000000',
        '#5C8A3A',
        '#3B9C8B',
        '#1F3A6E',
      ];
      presetHexes.forEach(hex => {
        const hsv = hexToHsv(hex);
        if (!hsv) {
          throw new Error(`expected hsv for ${hex}`);
        }
        expect(hsvToHex(hsv)).toBe(hex);
      });
    });

    it('returns null for invalid hex', () => {
      expect(hexToHsv('garbage')).toBeNull();
    });
  });
});
