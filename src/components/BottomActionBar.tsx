import type {ReactNode} from 'react';
import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import useThemeStyles from '@hooks/useThemeStyles';
import OfflineIndicator from './OfflineIndicator';

type BottomActionBarProps = {
  /** The action button(s) rendered inside the bottom bar */
  children: ReactNode;

  /** Additional styles for the bottom bar container (e.g. padding) */
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * A bottom-anchored action bar that renders an offline indicator directly above
 * its action button(s), so the reading order is "you appear to be offline" then
 * the disabled button. OfflineIndicator self-hides while online, so this adds no
 * visual gap when connected.
 *
 * The bar applies a default horizontal padding (`ph5`) so its button(s) never
 * touch the screen edges on any device. Pass `containerStyle` to add more (e.g.
 * `gap`/vertical padding) or to override the horizontal padding when needed.
 *
 * Screens using this should pass `shouldShowOfflineIndicator={false}` to their
 * `ScreenWrapper` to avoid a duplicate indicator rendering below the button.
 */
function BottomActionBar({children, containerStyle}: BottomActionBarProps) {
  const styles = useThemeStyles();

  return (
    <View style={styles.flexShrink0}>
      <OfflineIndicator />
      <View style={[styles.bottomTabBarContainer, styles.ph5, containerStyle]}>
        {children}
      </View>
    </View>
  );
}

BottomActionBar.displayName = 'BottomActionBar';

export default BottomActionBar;
