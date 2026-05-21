import type {Color} from './types';

/**
 * DO NOT import colors.js into files. Use the theme switching hooks and HOCs instead.
 * For functional components, you can use the `useTheme` and `useThemeStyles` hooks
 * For class components, you can use the `withTheme` and `withThemeStyles` HOCs
 */
const colors: Record<string, Color> = {
  // Brand Colors
  black: '#000000',
  white: '#FFFFFF',
  yellow: '#FFFF99',
  // yellowHover: '#FFFF66',
  // yellowPressed: '#FFFF7A',
  // yellowStrong: '#FCF50F',
  yellowHover: '#FFE072',
  yellowPressed: '#FFC457',
  yellowStrong: '#F5C400',
  red: '#FF4949',
  redHover: '#DB2A2A',
  redPressed: '#FF9999',
  transparent: 'transparent',

  // Dark Mode Theme Colors
  // productDark100: '#010409', // black
  productDark100: '#0D1117', // appBG
  productDark200: '#151B23', // card
  productDark300: '#212830', // search
  productDark400: '#3D444D', // border
  productDark500: '#1E2329', // button hovered
  productDark600: '#23282D', // button pressed
  productDark700: '#9198A1', // icon
  productDark800: '#E1E7ED', // text supporting
  productDark900: '#F0F6FC', // text

  // Light Mode Theme Colors
  productLight100: '#FFFFFF', // appBG
  productLight200: '#F6F8FA', // card
  productLight300: '#F6F8FA', // search // TODO
  productLight400: '#D0D9E0', // border
  productLight500: '#F2F3F4', // button hovered
  productLight600: '#EDEEEF', // button pressed
  productLight700: '#59636E', // icon
  productLight800: '#2F3339', // text supporting
  productLight900: '#1F2329', // text

  // Brand Colors from Figma
  blue100: '#B0D9FF',
  blue200: '#8DC8FF',
  blue300: '#5AB0FF',
  blue400: '#0185FF',
  blue500: '#0676DE',
  blue600: '#0164BF',
  blue700: '#003C73',
  blue800: '#002140',

  yellow100: '#FFF2B2',
  yellow200: '#FFED8F',
  yellow300: '#FEE45E',
  yellow400: '#FED607',
  yellow500: '#E4BC07',
  yellow600: '#D18000',
  yellow700: '#722B03',
  yellow800: '#401102',

  tangerine100: '#FFD7B0',
  tangerine200: '#FFC68C',
  tangerine300: '#FFA75A',
  tangerine400: '#FF7101',
  tangerine500: '#F25730',
  tangerine600: '#BF3013',
  tangerine700: '#780505',
  tangerine800: '#400000',

  pink100: '#FCDCFF',
  pink200: '#FBCCFF',
  pink300: '#F9B5FE',
  pink400: '#F68DFE',
  pink500: '#E96DF2',
  pink600: '#CF4CD9',
  pink700: '#712A76',
  pink800: '#49225B',

  ice100: '#DFFDFE',
  ice200: '#CCF7FF',
  ice300: '#A5FBFF',
  ice400: '#50EEF6',
  ice500: '#4ED7DE',
  ice600: '#4BA6A6',
  ice700: '#28736D',
  ice800: '#134038',

  orange100: '#FFF3E0',
  orange200: '#FFE0B2',
  orange300: '#FFCC80',
  orange400: '#FFB74D',
  orange500: '#FFA726',
  orange600: '#FB8C00',
  orange700: '#F57C00',
  orange800: '#EF6C00',
  orange900: '#E65100',
};

/**
 * Session severity palettes (green → yellow → orange → red → black).
 * Consumed by `src/libs/SessionColorPalettes.ts`. The keys here are the palette ids —
 * adding a new palette = one new entry. PaletteId, PALETTE_IDS, and PALETTES all derive from this.
 *
 * "Classic" uses hex equivalents of the CSS named colors so existing users see no visual change.
 * "Brand" and "pink" pull from the shared color tokens above to stay consistent with app theming.
 */
const sessionPaletteColors = {
  classic: {
    green: '#008000',
    yellow: '#FFFF00',
    orange: '#FFA500',
    red: '#FF0000',
    black: '#000000',
  },
  sunset: {
    green: '#5C8A3A',
    yellow: '#F2C14E',
    orange: '#F08A4B',
    red: '#C8412B',
    black: '#1A0F0A',
  },
  ocean: {
    green: '#3B9C8B',
    yellow: '#6FB8D6',
    orange: '#3F7EA5',
    red: '#1F3A6E',
    black: '#0A1530',
  },
  mono: {
    green: '#D0D0D0',
    yellow: '#9A9A9A',
    orange: '#6A6A6A',
    red: '#3A3A3A',
    black: '#000000',
  },
  colorblindSafe: {
    green: '#117733',
    yellow: '#DDCC77',
    orange: '#E69F00',
    red: '#CC3311',
    black: '#000000',
  },
  brand: {
    green: colors.tangerine100,
    yellow: colors.tangerine300,
    orange: colors.tangerine400,
    red: colors.tangerine600,
    black: '#000000',
  },
  pink: {
    green: colors.pink100,
    yellow: colors.pink300,
    orange: colors.pink500,
    red: colors.red,
    black: '#000000',
  },
};

export {sessionPaletteColors};
export default colors;
