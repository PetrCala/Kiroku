import React from 'react';
import {View} from 'react-native';
import type {ViewProps} from 'react-native';

/**
 * Phase 0 web shim for `react-native-linear-gradient`.
 *
 * The native package (v2.8.3) only branches ios/android/windows and ships no web build, so on web it
 * reaches a native impl that calls `requireNativeComponent` (absent from react-native-web) and throws.
 * It's imported on the public/login landing (`src/screens/SignUp/InitialScreen.tsx`), so without this
 * shim the login screen never renders.
 *
 * This keeps the layout intact and approximates the gradient with a top-to-bottom CSS `linear-gradient`
 * built from the same `colors`/`locations`. A faithful angle-aware implementation (or swapping in
 * `react-native-web-linear-gradient`) is deferred to the native-module-shims pass (#930).
 *
 * Aliased in `config/webpack/webpack.common.ts`: `react-native-linear-gradient` → this file.
 */
type LinearGradientProps = ViewProps & {
  colors?: string[];
  locations?: number[];
  // Accepted for API compatibility; direction is approximated as top→bottom on web for now.
  start?: {x: number; y: number};
  end?: {x: number; y: number};
  useAngle?: boolean;
  angle?: number;
};

function buildGradientStyle(
  colors?: string[],
  locations?: number[],
): {backgroundImage?: string; backgroundColor?: string} {
  if (!colors || colors.length === 0) {
    return {};
  }
  if (colors.length === 1) {
    return {backgroundColor: colors[0]};
  }
  const stops = colors.map((color, index) => {
    const stop = locations?.[index];
    return typeof stop === 'number'
      ? `${color} ${Math.round(stop * 100)}%`
      : color;
  });
  return {backgroundImage: `linear-gradient(to bottom, ${stops.join(', ')})`};
}

function LinearGradient({
  colors,
  locations,
  start,
  end,
  useAngle,
  angle,
  style,
  children,
  ...rest
}: LinearGradientProps) {
  const gradientStyle = buildGradientStyle(colors, locations);

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <View
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...rest}
      // `backgroundImage` is a web-only style; react-native-web forwards it to the DOM node.
      style={[style, gradientStyle]}>
      {children}
    </View>
  );
}

LinearGradient.displayName = 'LinearGradientWebShim';

export {LinearGradient};
export default LinearGradient;
