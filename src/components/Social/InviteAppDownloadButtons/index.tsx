import React from 'react';
import {Image, Linking, StyleSheet, View} from 'react-native';
import type {ImageSourcePropType, ImageStyle} from 'react-native';
import AppStoreBadge from '@assets/images/store-badges/app-store-badge.png';
import GooglePlayBadge from '@assets/images/store-badges/google-play-badge.png';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {PressableWithFeedback} from '@components/Pressable';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import getOperatingSystem from '@libs/getOperatingSystem';
import getStoreBadgeLayout from '@libs/StoreBadgeUtils';
import type {StoreBadge} from '@libs/StoreBadgeUtils';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';

/** Legible and above both stores' minimum badge size. */
const BADGE_HEIGHT = 44;

/** The app mark next to the "Get the Kiroku app" line. */
const BRAND_MARK_SIZE = 32;

const localStyles = StyleSheet.create({
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  badgeRow: {
    gap: 12,
  },
  // Aspect ratios of the bundled 450px badge renders.
  appStoreBadge: {
    height: BADGE_HEIGHT,
    aspectRatio: 450 / 133,
  },
  googlePlayBadge: {
    height: BADGE_HEIGHT,
    aspectRatio: 450 / 132,
  },
});

type BadgeConfig = {
  source: ImageSourcePropType;
  style: ImageStyle;
  url: string;
  label: TranslationPaths;
};

// The official store badge artwork kiroku.cz uses, unmodified. Each badge is
// a link whose label repeats the words printed on it.
const BADGES: Record<StoreBadge, BadgeConfig> = {
  appStore: {
    source: AppStoreBadge,
    style: localStyles.appStoreBadge,
    url: CONST.STORE_LINKS.IOS,
    label: 'addFriendScreen.appStoreBadge',
  },
  googlePlay: {
    source: GooglePlayBadge,
    style: localStyles.googlePlayBadge,
    url: CONST.STORE_LINKS.ANDROID,
    label: 'addFriendScreen.googlePlayBadge',
  },
};

/**
 * App downloads under a signed-out invite preview, ported from the kiroku.cz
 * download section: the app mark and a quiet "Get the Kiroku app" line, then
 * the official App Store and Google Play badges. The visitor's own store comes
 * first, and both always show. Web only: the native build renders nothing
 * (see `index.native.tsx`). Sign-in above stays the primary action.
 */
function InviteAppDownloadButtons() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {badges, hint} = getStoreBadgeLayout(getOperatingSystem());

  return (
    <View
      style={[
        styles.w100,
        styles.alignItemsCenter,
        styles.mt8,
        styles.pt5,
        localStyles.divider,
        {borderTopColor: theme.border},
      ]}>
      <View style={[styles.flexRow, styles.alignItemsCenter]}>
        <Icon
          src={KirokuIcons.Logo}
          width={BRAND_MARK_SIZE}
          height={BRAND_MARK_SIZE}
        />
        <Text style={[styles.textNormal, styles.textStrong, styles.ml2]}>
          {translate('addFriendScreen.getTheApp')}
        </Text>
      </View>
      <Text
        style={[
          styles.textLabelSupporting,
          styles.textAlignCenter,
          styles.mt1,
        ]}>
        {translate(hint)}
      </Text>
      <View
        style={[
          styles.flexRow,
          styles.flexWrap,
          styles.justifyContentCenter,
          styles.mt4,
          localStyles.badgeRow,
        ]}>
        {badges.map(badge => {
          const config = BADGES[badge];
          return (
            <PressableWithFeedback
              key={badge}
              accessibilityRole={CONST.ROLE.LINK}
              accessibilityLabel={translate(config.label)}
              onPress={() => {
                Linking.openURL(config.url);
              }}>
              <Image
                source={config.source}
                style={config.style}
                resizeMode="contain"
              />
            </PressableWithFeedback>
          );
        })}
      </View>
    </View>
  );
}

InviteAppDownloadButtons.displayName = 'InviteAppDownloadButtons';
export default InviteAppDownloadButtons;
