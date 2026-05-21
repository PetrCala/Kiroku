import type {SessionColorPalette} from '@src/types/onyx';

type PaletteId = 'CLASSIC' | 'SUNSET' | 'OCEAN' | 'MONO' | 'COLORBLIND_SAFE';

const PALETTE_IDS: readonly PaletteId[] = [
  'CLASSIC',
  'SUNSET',
  'OCEAN',
  'MONO',
  'COLORBLIND_SAFE',
] as const;

const PALETTES: Record<PaletteId, SessionColorPalette> = {
  // Hex equivalents of CSS named colors so existing users see no visual change
  CLASSIC: {
    green: '#008000',
    yellow: '#FFFF00',
    orange: '#FFA500',
    red: '#FF0000',
    black: '#000000',
  },
  SUNSET: {
    green: '#5C8A3A',
    yellow: '#F2C14E',
    orange: '#F08A4B',
    red: '#C8412B',
    black: '#1A0F0A',
  },
  OCEAN: {
    green: '#3B9C8B',
    yellow: '#6FB8D6',
    orange: '#3F7EA5',
    red: '#1F3A6E',
    black: '#0A1530',
  },
  MONO: {
    green: '#D0D0D0',
    yellow: '#9A9A9A',
    orange: '#6A6A6A',
    red: '#3A3A3A',
    black: '#000000',
  },
  COLORBLIND_SAFE: {
    green: '#117733',
    yellow: '#DDCC77',
    orange: '#E69F00',
    red: '#CC3311',
    black: '#000000',
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
