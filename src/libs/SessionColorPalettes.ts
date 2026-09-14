import type {SessionColorPalette} from '@src/types/onyx';
import {sessionPaletteColors} from '@styles/theme/colors';
import type {Rgb} from './Color';
import {parseHex} from './Color';

type PaletteId = keyof typeof sessionPaletteColors;

const PALETTES: Record<PaletteId, SessionColorPalette> = sessionPaletteColors;

const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];

const DEFAULT_PALETTE_ID: PaletteId = 'classic';

function getPaletteIdFromColors(
  palette: SessionColorPalette | undefined,
): PaletteId | null {
  if (!palette) {
    return null;
  }
  for (const id of PALETTE_IDS) {
    const preset = PALETTES[id];
    if (
      preset.green === palette.green &&
      preset.yellow === palette.yellow &&
      preset.orange === palette.orange &&
      preset.red === palette.red &&
      preset.black === palette.black
    ) {
      return id;
    }
  }
  return null;
}

function resolvePalette(
  palette: SessionColorPalette | undefined,
): SessionColorPalette {
  return palette ?? PALETTES[DEFAULT_PALETTE_ID];
}

function rgbLuminance({r, g, b}: Rgb): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function hexLuminance(color: string): number | null {
  const rgb = parseHex(color);
  return rgb ? rgbLuminance(rgb) : null;
}

function isLightHex(color: string): boolean {
  const lum = hexLuminance(color);
  return lum !== null && lum > 0.6;
}

function toHexByte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0');
}

// How far to nudge a swatch toward black/white when synthesising a border
// from it. 0.25 lands deep enough to read as an edge on every palette without
// overpowering vivid swatches.
const DERIVED_SWATCH_BORDER_MIX = 0.25;

/**
 * Derives a border color by mixing the swatch toward black on light
 * backgrounds (or white on dark backgrounds), so a palette-colored surface
 * gets a subtle, swatch-harmonious edge that always contrasts the app
 * background (accent rows, swatch chips).
 */
function getDerivedSwatchBorderColor(
  swatch: string,
  background: string,
): string | null {
  const swatchRgb = parseHex(swatch);
  const bgLum = hexLuminance(background);
  if (!swatchRgb || bgLum === null) {
    return null;
  }
  const target = bgLum > 0.5 ? 0 : 255;
  const mix = DERIVED_SWATCH_BORDER_MIX;
  const r = swatchRgb.r * (1 - mix) + target * mix;
  const g = swatchRgb.g * (1 - mix) + target * mix;
  const b = swatchRgb.b * (1 - mix) + target * mix;
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

// Alcohol-free tile ramp. A sober day's tile is the palette green at an
// opacity that grows with the day's position in a run of consecutive sober
// days: the first day is a faint tint, and the run reaches the full swatch on
// day CALENDAR_AF_STREAK_CAP. A single sober day stays quiet; a week without a
// session fills in, so the solid green is something the calendar builds up to
// rather than the default state of every empty day.
const CALENDAR_AF_STREAK_CAP = 7;
const CALENDAR_AF_TINT_BASE = 0.15;
const CALENDAR_AF_TINT_STEP = 0.145;
// Above this opacity the tint reads as a filled tile, so the day number flips
// to the on-swatch text color (same rule as a session tile).
const CALENDAR_AF_SOLID_THRESHOLD = 0.8;

type CalendarAlcoholFreeTint = {
  /** The tile background: `swatch` with an alpha byte, or the plain swatch
   *  once the run has saturated. */
  color: string;
  /** Whether the tint is opaque enough for the on-swatch text color. */
  isSolid: boolean;
};

/**
 * Background for an alcohol-free day's tile, given the day's 1-based position
 * in its run of consecutive alcohol-free days (clamped to the cap). Falls back
 * to the plain swatch for a color that isn't a hex triplet.
 */
function getCalendarAlcoholFreeTint(
  swatch: string,
  streak: number,
): CalendarAlcoholFreeTint {
  const position = Math.max(
    1,
    Math.min(CALENDAR_AF_STREAK_CAP, Math.floor(streak)),
  );
  const alpha = Math.min(
    1,
    CALENDAR_AF_TINT_BASE + CALENDAR_AF_TINT_STEP * (position - 1),
  );
  const rgb = parseHex(swatch);
  if (!rgb || alpha >= 1) {
    return {color: swatch, isSolid: true};
  }
  return {
    color: `#${toHexByte(rgb.r)}${toHexByte(rgb.g)}${toHexByte(rgb.b)}${toHexByte(alpha * 255)}`,
    isSolid: alpha >= CALENDAR_AF_SOLID_THRESHOLD,
  };
}

export type {PaletteId, CalendarAlcoholFreeTint};
export {
  CALENDAR_AF_STREAK_CAP,
  PALETTE_IDS,
  PALETTES,
  DEFAULT_PALETTE_ID,
  getPaletteIdFromColors,
  resolvePalette,
  isLightHex,
  getCalendarAlcoholFreeTint,
  getDerivedSwatchBorderColor,
};
