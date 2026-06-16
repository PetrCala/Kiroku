import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import useLocalize from '@hooks/useLocalize';
import SupporterUtils from '@libs/SupporterUtils';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import Badge from './Badge';
import * as KirokuIcons from './Icon/KirokuIcons';

type PlusBadgeProps = {
  /** When locked, shows a lock icon; otherwise a star. */
  locked?: boolean;

  /** Extra styles forwarded to the underlying badge. */
  badgeStyles?: StyleProp<ViewStyle>;
};

/**
 * Small "Plus" pill marking a paid feature. Pressable — it routes to the
 * Support Kiroku paywall so locked rows double as an upsell entry point.
 *
 * Renders `null` when premium gates are inactive (production until v1.1), so no
 * Plus iconography ever ships while the gated features are free. Mirrors the
 * return-null discipline of `SupporterBadge`.
 */
function PlusBadge({locked = false, badgeStyles}: PlusBadgeProps) {
  const {translate} = useLocalize();

  if (!SupporterUtils.arePremiumGatesActive()) {
    return null;
  }

  return (
    <Badge
      pressable
      text={translate('premiumFeatures.plusBadge')}
      icon={locked ? KirokuIcons.Lock : KirokuIcons.Star}
      badgeStyles={badgeStyles}
      onPress={() => Navigation.navigate(ROUTES.SETTINGS_SUPPORT)}
    />
  );
}

PlusBadge.displayName = 'PlusBadge';

export default PlusBadge;
