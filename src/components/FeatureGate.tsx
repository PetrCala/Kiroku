import React from 'react';
import {View} from 'react-native';
import useFeatureAccess from '@hooks/useFeatureAccess';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import useTheme from '@hooks/useTheme';
import type {PremiumFeatureKey} from '@libs/Entitlements';
import Navigation from '@libs/Navigation/Navigation';
import variables from '@styles/variables';
import ROUTES from '@src/ROUTES';
import Icon from './Icon';
import * as KirokuIcons from './Icon/KirokuIcons';
import PlusBadge from './PlusBadge';
import PressableWithoutFeedback from './Pressable/PressableWithoutFeedback';

type FeatureGateMode = 'badge' | 'hide' | 'overlay';

type FeatureGateProps = {
  /** The registered premium feature whose access decides the rendering. */
  feature: PremiumFeatureKey;

  /**
   * How to present a locked feature:
   * - `badge` (default): render children with a trailing Plus badge.
   * - `hide`: render nothing while locked.
   * - `overlay`: dim children behind a lock + route to the paywall on press.
   */
  mode?: FeatureGateMode;

  /** The feature content. */
  children: React.ReactNode;
};

/**
 * Declarative wrapper around `useFeatureAccess` for guarding a feature surface.
 * Not in the build (`!isAvailable`) renders nothing. While the decision is
 * still resolving, children render plainly (no badge/lock) so nothing flickers
 * locked on cold boot.
 */
function FeatureGate({feature, mode = 'badge', children}: FeatureGateProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {isAvailable, isLocked, isResolving} = useFeatureAccess(feature);

  if (!isAvailable) {
    return null;
  }

  // Optimistically unlocked while resolving — never present the locked state
  // until we have a definitive answer.
  if (isResolving || !isLocked) {
    if (mode === 'badge') {
      return (
        <View style={[styles.flexRow, styles.alignItemsCenter]}>
          {children}
          {!isResolving ? <PlusBadge locked={false} /> : null}
        </View>
      );
    }
    return children;
  }

  if (mode === 'hide') {
    return null;
  }

  if (mode === 'overlay') {
    return (
      <PressableWithoutFeedback
        accessibilityLabel={translate(
          'premiumFeatures.upsellAccessibilityLabel',
        )}
        onPress={() => Navigation.navigate(ROUTES.SETTINGS_SUPPORT)}
        style={[styles.flexRow, styles.alignItemsCenter]}>
        <View style={[styles.flex1, styles.opacitySemiTransparent]}>
          {children}
        </View>
        <View
          style={[
            styles.alignItemsCenter,
            styles.justifyContentCenter,
            styles.ml2,
          ]}>
          <Icon
            src={KirokuIcons.Lock}
            fill={theme.icon}
            width={variables.iconSizeNormal}
            height={variables.iconSizeNormal}
          />
        </View>
      </PressableWithoutFeedback>
    );
  }

  // Default 'badge' mode while locked: children + locked Plus badge.
  return (
    <View style={[styles.flexRow, styles.alignItemsCenter]}>
      {children}
      <PlusBadge locked />
    </View>
  );
}

FeatureGate.displayName = 'FeatureGate';

export default FeatureGate;
export type {FeatureGateMode, FeatureGateProps};
