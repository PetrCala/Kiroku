import {useFont} from '@shopify/react-native-skia';
import type {SkFont} from '@shopify/react-native-skia';

const CHART_FONT = require<number>('@assets/fonts/native/ExpensifyNeue-Regular.otf');

/**
 * Loads the app's brand font as a Skia `SkFont` for use in chart axis labels.
 * victory-native renders axis tick *numbers* only when given a font; without
 * one it draws ticks and lines but no labels. Returns `null` until the OTF
 * asset has loaded, so callers must tolerate a font-less first render.
 */
function useChartFont(size = 11): SkFont | null {
  return useFont(CHART_FONT, size);
}

export default useChartFont;
