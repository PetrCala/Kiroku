import {GlassView, isLiquidGlassAvailable} from 'expo-glass-effect';
import React from 'react';
import {View} from 'react-native';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

// iOS 26 ships the native Liquid Glass material; older iOS and Android do not.
// The value is fixed for the session, so it's evaluated once at module load.
const SUPPORTS_LIQUID_GLASS = isLiquidGlassAvailable();

type FloatingActionSurfaceProps = {
  /* The icon (or other content) centered inside the circle */
  children: React.ReactNode;
};

/**
 * The visual circle of a static-icon floating action button: Liquid Glass
 * tinted with the brand color on iOS 26, a solid brand-colored circle with a
 * soft drop shadow elsewhere. Purely presentational — wrap it in a Pressable
 * and place an icon inside. For the animated start-session FAB (rotation +
 * active-state color), see FloatingActionButton instead.
 */
function FloatingActionSurface({children}: FloatingActionSurfaceProps) {
  const theme = useTheme();
  const styles = useThemeStyles();

  return SUPPORTS_LIQUID_GLASS ? (
    <GlassView
      glassEffectStyle="regular"
      tintColor={theme.appColor}
      colorScheme={theme.colorScheme}
      style={styles.floatingActionButtonGlass}>
      {children}
    </GlassView>
  ) : (
    <View style={styles.floatingActionButton}>{children}</View>
  );
}

FloatingActionSurface.displayName = 'FloatingActionSurface';

export default FloatingActionSurface;
