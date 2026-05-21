import type {SessionColorPalette} from '@src/types/onyx';
import {sessionPaletteColors as c} from '@styles/theme/colors';

type PaletteId = 'CLASSIC' | 'SUNSET' | 'OCEAN' | 'MONO' | 'COLORBLIND_SAFE';

const PALETTE_IDS: readonly PaletteId[] = [
  'CLASSIC',
  'SUNSET',
  'OCEAN',
  'MONO',
  'COLORBLIND_SAFE',
] as const;

const PALETTES: Record<PaletteId, SessionColorPalette> = {
  CLASSIC: {
    green: c.classicGreen,
    yellow: c.classicYellow,
    orange: c.classicOrange,
    red: c.classicRed,
    black: c.classicBlack,
  },
  SUNSET: {
    green: c.sunsetGreen,
    yellow: c.sunsetYellow,
    orange: c.sunsetOrange,
    red: c.sunsetRed,
    black: c.sunsetBlack,
  },
  OCEAN: {
    green: c.oceanGreen,
    yellow: c.oceanYellow,
    orange: c.oceanOrange,
    red: c.oceanRed,
    black: c.oceanBlack,
  },
  MONO: {
    green: c.monoGreen,
    yellow: c.monoYellow,
    orange: c.monoOrange,
    red: c.monoRed,
    black: c.monoBlack,
  },
  COLORBLIND_SAFE: {
    green: c.colorblindSafeGreen,
    yellow: c.colorblindSafeYellow,
    orange: c.colorblindSafeOrange,
    red: c.colorblindSafeRed,
    black: c.colorblindSafeBlack,
  },
};

const DEFAULT_PALETTE_ID: PaletteId = 'CLASSIC';

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

function isLightHex(color: string): boolean {
  let hex = color.trim();
  if (!hex.startsWith('#')) {
    return false;
  }
  if (hex.length === 4) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (hex.length !== 7) {
    return false;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return false;
  }
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6;
}

export type {PaletteId};
export {
  PALETTE_IDS,
  PALETTES,
  DEFAULT_PALETTE_ID,
  getPaletteIdFromColors,
  resolvePalette,
  isLightHex,
};
