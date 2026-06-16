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

// How far to nudge the swatch toward black/white when synthesising the tile
// border. 0.25 lands deep enough to read as an edge on every palette without
// overpowering vivid swatches.
const CALENDAR_TILE_BORDER_MIX = 0.25;

/**
 * Derives a per-tile border color by mixing the swatch toward black on light
 * backgrounds (or white on dark backgrounds). Every calendar tile gets a
 * subtle, swatch-harmonious edge that always contrasts the app background.
 */
function getCalendarTileBorderColor(
  swatch: string,
  background: string,
): string | null {
  const swatchRgb = parseHex(swatch);
  const bgLum = hexLuminance(background);
  if (!swatchRgb || bgLum === null) {
    return null;
  }
  const target = bgLum > 0.5 ? 0 : 255;
  const mix = CALENDAR_TILE_BORDER_MIX;
  const r = swatchRgb.r * (1 - mix) + target * mix;
  const g = swatchRgb.g * (1 - mix) + target * mix;
  const b = swatchRgb.b * (1 - mix) + target * mix;
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

export type {PaletteId};
export {
  PALETTE_IDS,
  PALETTES,
  DEFAULT_PALETTE_ID,
  getPaletteIdFromColors,
  resolvePalette,
  isLightHex,
  getCalendarTileBorderColor,
};
