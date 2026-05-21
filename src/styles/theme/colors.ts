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
 * Hex tokens for session severity palettes (green → yellow → orange → red → black).
 * Consumed by `src/libs/SessionColorPalettes.ts` — keep hex values here, not in logic code.
 */
const sessionPaletteColors = {
  // Hex equivalents of CSS named colors so existing users see no visual change
  classicGreen: '#008000',
  classicYellow: '#FFFF00',
  classicOrange: '#FFA500',
  classicRed: '#FF0000',
  classicBlack: '#000000',

  sunsetGreen: '#5C8A3A',
  sunsetYellow: '#F2C14E',
  sunsetOrange: '#F08A4B',
  sunsetRed: '#C8412B',
  sunsetBlack: '#1A0F0A',

  oceanGreen: '#3B9C8B',
  oceanYellow: '#6FB8D6',
  oceanOrange: '#3F7EA5',
  oceanRed: '#1F3A6E',
  oceanBlack: '#0A1530',

  monoGreen: '#D0D0D0',
  monoYellow: '#9A9A9A',
  monoOrange: '#6A6A6A',
  monoRed: '#3A3A3A',
  monoBlack: '#000000',

  colorblindSafeGreen: '#117733',
  colorblindSafeYellow: '#DDCC77',
  colorblindSafeOrange: '#E69F00',
  colorblindSafeRed: '#CC3311',
  colorblindSafeBlack: '#000000',
} as const;

export {sessionPaletteColors};
export default colors;
