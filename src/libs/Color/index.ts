/**
 * Pure color-math helpers (no React, no platform APIs). This is the single
 * source of truth for parsing/serializing hex colors and converting between the
 * RGB and HSV color spaces used by the hand-built color picker.
 *
 * HSV is represented as `{h: 0-360, s: 0-1, v: 0-1}`.
 */

/** An RGB color with 0-255 channels. */
type Rgb = {r: number; g: number; b: number};

/** An HSV color (`h` in degrees 0-360, `s`/`v` in 0-1). */
type Hsv = {h: number; s: number; v: number};

/**
 * Strict hex parser: requires a leading `#`, accepts `#rgb` shorthand or
 * `#rrggbb`. Returns the RGB triplet, or `null` when the input is malformed.
 * This is the canonical parser shared across the app (luminance, swatch
 * borders, the picker).
 */
function parseHex(color: string): Rgb | null {
  let hex = color.trim();
  if (!hex.startsWith('#')) {
    return null;
  }
  if (hex.length === 4) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (hex.length !== 7) {
    return null;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return null;
  }
  return {r, g, b};
}

const HEX_PATTERN = /^[0-9a-f]{3}$|^[0-9a-f]{6}$/i;

/**
 * Lenient hex normalizer for user input. Tolerates a missing `#`, surrounding
 * whitespace, `#abc` shorthand, and any letter case; rejects anything else.
 * Returns the canonical `#RRGGBB` (uppercase) form, or `null` when invalid.
 */
function normalizeHex(input: string): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  let hex = input.trim();
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (!HEX_PATTERN.test(hex)) {
    return null;
  }
  if (hex.length === 3) {
    hex = `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  return `#${hex.toUpperCase()}`;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHexByte(value: number): string {
  return clampByte(value).toString(16).padStart(2, '0');
}

/** Parse any hex string (lenient) into RGB, or `null` when invalid. */
function hexToRgb(hex: string): Rgb | null {
  const normalized = normalizeHex(hex);
  return normalized ? parseHex(normalized) : null;
}

/** Serialize RGB into a canonical `#RRGGBB` (uppercase) string. */
function rgbToHex({r, g, b}: Rgb): string {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`.toUpperCase();
}

/** Convert RGB (0-255) to HSV. */
function rgbToHsv({r, g, b}: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return {h, s, v};
}

/** Convert HSV back to RGB (0-255). */
function hsvToRgb({h, s, v}: Hsv): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = v - c;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hue < 60) {
    r1 = c;
    g1 = x;
  } else if (hue < 120) {
    r1 = x;
    g1 = c;
  } else if (hue < 180) {
    g1 = c;
    b1 = x;
  } else if (hue < 240) {
    g1 = x;
    b1 = c;
  } else if (hue < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return {
    r: clampByte((r1 + m) * 255),
    g: clampByte((g1 + m) * 255),
    b: clampByte((b1 + m) * 255),
  };
}

/** Convert any hex string (lenient) to HSV, or `null` when invalid. */
function hexToHsv(hex: string): Hsv | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsv(rgb) : null;
}

/** Convert HSV to a canonical `#RRGGBB` (uppercase) hex string. */
function hsvToHex(hsv: Hsv): string {
  return rgbToHex(hsvToRgb(hsv));
}

export type {Rgb, Hsv};
export {
  parseHex,
  normalizeHex,
  hexToRgb,
  rgbToHex,
  rgbToHsv,
  hsvToRgb,
  hexToHsv,
  hsvToHex,
};
