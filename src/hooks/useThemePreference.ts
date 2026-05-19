import {useContext, useEffect, useMemo} from 'react';
import type {ColorSchemeName} from 'react-native';
import {useColorScheme} from 'react-native';
import {PreferredThemeContext} from '@components/OnyxProvider';
import CONST from '@src/CONST';
import useDebouncedState from './useDebouncedState';

function useThemePreference() {
  const preferredThemeFromStorage = useContext(PreferredThemeContext);
  const systemTheme = useColorScheme();

  // iOS briefly fires transient `useColorScheme()` changes during the
  // app-switcher gesture (see Expensify#48299). Debounce only the system
  // appearance so those spurious flips don't reach the rendered theme. The
  // stored preference does not flicker and must remain un-debounced — adding
  // latency there causes a visible light->dark flash on cold launch once
  // Onyx hydrates.
  const [, debouncedSystemTheme, setDebouncedSystemTheme] =
    useDebouncedState<ColorSchemeName>(systemTheme);

  useEffect(() => {
    setDebouncedSystemTheme(systemTheme);
  }, [setDebouncedSystemTheme, systemTheme]);

  const themePreference = useMemo(() => {
    const theme = preferredThemeFromStorage ?? CONST.THEME.DEFAULT;

    // If the user chooses to use the device theme settings, set the theme preference to the system theme
    return theme === CONST.THEME.SYSTEM
      ? debouncedSystemTheme ?? CONST.THEME.FALLBACK
      : theme;
  }, [preferredThemeFromStorage, debouncedSystemTheme]);

  return themePreference;
}

export default useThemePreference;
