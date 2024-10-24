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
  ivory: '#fffaf0',
  yellow: '#FFFF99',
  yellowHover: '#FFFF66',
  yellowPressed: '#FFFFB2',
  // yellowStrong: '#FCF50F',
  yellowStrong: '#F5C400',
  red: '#FF4949',
  redHover: '#DB2A2A',
  redPressed: '#FF9999',
  transparent: 'transparent',

  // Dark Mode Theme Colors
  productDark100: '#1B1B06',
  productDark200: '#1F2407',
  productDark300: '#1A2E0A',
  productDark400: '#353D1A',
  productDark500: '#4A4F22',
  productDark600: '#56602A',
  productDark700: '#9C9C8B',
  productDark800: '#BBBBAF',
  productDark900: '#ECECE7',

  // Light Mode Theme Colors
  productLight100: '#FCFBF9',
  productLight200: '#F8F4F0',
  productLight300: '#F2EDE7',
  productLight400: '#E6E1DA',
  productLight500: '#D8D1C7',
  productLight600: '#C7BFB3',
  productLight700: '#A9A9A3',
  productLight800: '#84847E',
  productLight900: '#2C2E22',

  // Brand Colors from Figma
  blue100: '#B0D9FF',
  blue200: '#8DC8FF',
  blue300: '#5AB0FF',
  blue400: '#0185FF',
  blue500: '#0676DE',
  blue600: '#0164BF',
  blue700: '#003C73',
  blue800: '#002140',

  green100: '#B1F2D6',
  green200: '#8EECC4',
  green300: '#5BE3AA',
  green400: '#03D47C',
  green500: '#00B268',
  green600: '#008C59',
  green700: '#085239',
  green800: '#002E22',

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
};

export default colors;
