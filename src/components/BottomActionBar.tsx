import {GlassView, isLiquidGlassAvailable} from 'expo-glass-effect';
import type {ReactNode} from 'react';
import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {StyleSheet, View} from 'react-native';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import OfflineIndicator from './OfflineIndicator';

// iOS 26 ships native Liquid Glass; older iOS and Android do not. The value is
// fixed for the session, so it's evaluated once at module load.
const SUPPORTS_LIQUID_GLASS = isLiquidGlassAvailable();

type BottomActionBarProps = {
  /** The action button(s) rendered inside the bottom bar */
  children: ReactNode;

  /** Additional styles for the bottom bar container (e.g. padding) */
  containerStyle?: StyleProp<ViewStyle>;

  /** Render the bar as an iOS 26 liquid-glass material instead of the opaque
   *  fill (no-op without Liquid Glass support). Opt-in per caller; defaults off. */
  shouldUseGlassBackground?: boolean;
};

/**
 * A bottom-anchored action bar that renders an offline indicator directly above
 * its action button(s), so the reading order is "you appear to be offline" then
 * the disabled button. OfflineIndicator self-hides while online, so this adds no
 * visual gap when connected.
 *
 * Screens using this should pass `shouldShowOfflineIndicator={false}` to their
 * `ScreenWrapper` to avoid a duplicate indicator rendering below the button.
 */
function BottomActionBar({
  children,
  containerStyle,
  shouldUseGlassBackground = false,
}: BottomActionBarProps) {
  const styles = useThemeStyles();
  const theme = useTheme();

  // Drop the opaque fill and the hard hairline so the glass material provides
  // both the surface and its own edge separation (the iOS 26 toolbar look).
  const useGlass = shouldUseGlassBackground && SUPPORTS_LIQUID_GLASS;
  const glassOverride = useGlass
    ? {backgroundColor: theme.transparent, borderTopWidth: 0}
    : undefined;

  return (
    <View style={styles.flexShrink0}>
      <OfflineIndicator />
      <View
        style={[styles.bottomTabBarContainer, containerStyle, glassOverride]}>
        {useGlass && (
          <GlassView
            style={StyleSheet.absoluteFill}
            glassEffectStyle="regular"
            colorScheme={theme.colorScheme}
          />
        )}
        {children}
      </View>
    </View>
  );
}

BottomActionBar.displayName = 'BottomActionBar';

export default BottomActionBar;
