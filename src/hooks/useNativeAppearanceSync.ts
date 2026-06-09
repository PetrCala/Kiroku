import {useContext, useEffect} from 'react';
import {Appearance, Platform} from 'react-native';
import {PreferredThemeContext} from '@components/OnyxProvider';
import CONST from '@src/CONST';

/**
 * Propagates the user's selected app theme to the *native* interface style
 * (`UIUserInterfaceStyle` on iOS, night mode on Android) via
 * `Appearance.setColorScheme`.
 *
 * Kiroku's theme is otherwise JS-only, so native, system-drawn surfaces keep
 * following the *device* appearance and look light while the app paints dark.
 * The most visible offender is the iOS 26 Liquid Glass tab bar: its moving
 * selection capsule picks its light/dark variant from the native interface
 * style, so in dark theme over a light device it shows a bright hue while
 * switching tabs. Native alerts, action sheets and the keyboard share the same
 * gap. Syncing the native style keeps them consistent with the chosen theme.
 *
 * Resolution mirrors `useThemePreference`: an explicit light/dark choice forces
 * that style; following the system clears the override (`null`) so the native
 * side keeps tracking the device and `useColorScheme()` stays reactive (no
 * feedback loop, no stuck override when the device appearance later changes).
 *
 * Android note: `MainActivity` declares `uiMode` in `configChanges`, so the
 * underlying `setDefaultNightMode` delivers `onConfigurationChanged` rather
 * than recreating the activity — no JS reload.
 */
function useNativeAppearanceSync() {
  const preferredTheme = useContext(PreferredThemeContext);

  useEffect(() => {
    // Native-only: this drives the native interface style (UIKit on iOS, night
    // mode on Android). Web has no equivalent and renders its own JS tab bar.
    if (Platform.OS === 'web') {
      return;
    }

    if (preferredTheme === CONST.THEME.SYSTEM) {
      // Follow the device appearance.
      Appearance.setColorScheme(null);
      return;
    }

    Appearance.setColorScheme(
      preferredTheme === CONST.THEME.DARK
        ? CONST.COLOR_SCHEME.DARK
        : // LIGHT, or unset (defaults to light, mirroring useThemePreference).
          CONST.COLOR_SCHEME.LIGHT,
    );
  }, [preferredTheme]);
}

export default useNativeAppearanceSync;
