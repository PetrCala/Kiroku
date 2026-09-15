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

/**
 * Mix `color` toward `target` by `amount` (0 = color, 1 = target). Returns
 * `color` unchanged when either input isn't a hex triplet.
 */
function mixHex(color: string, target: string, amount: number): string {
  const a = parseHex(color);
  const b = parseHex(target);
  if (!a || !b) {
    return color;
  }
  const t = Math.max(0, Math.min(1, amount));
  return `#${toHexByte(a.r * (1 - t) + b.r * t)}${toHexByte(
    a.g * (1 - t) + b.g * t,
  )}${toHexByte(a.b * (1 - t) + b.b * t)}`;
}

export type {PaletteId};
export {
  PALETTE_IDS,
  PALETTES,
  DEFAULT_PALETTE_ID,
  getPaletteIdFromColors,
  resolvePalette,
  isLightHex,
  mixHex,
  getDerivedSwatchBorderColor,
};
