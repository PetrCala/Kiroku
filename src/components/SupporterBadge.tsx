import React from 'react';
import {useOnyx} from 'react-native-onyx';
import useLocalize from '@hooks/useLocalize';
import SupporterUtils from '@libs/SupporterUtils';
import * as UserUtils from '@libs/UserUtils';
import {useFirebase} from '@context/global/FirebaseContext';
import variables from '@styles/variables';
import ONYXKEYS from '@src/ONYXKEYS';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import Text from './Text';

const SUPPORTER_BADGE_EMOJI = '🍺';

type SupporterBadgeSize = 'small' | 'medium';

const SIZE_TO_FONT_SIZE: Record<SupporterBadgeSize, number> = {
  small: variables.fontSizeSmall,
  medium: variables.fontSizeMedium,
};

type SupporterBadgeProps = {
  /** Whether the user holds an active supporter entitlement. */
  isSupporter: boolean;

  /** Visual scale — `small` for friend lists, `medium` for profile views. */
  size?: SupporterBadgeSize;
};

/**
 * Purely presentational badge that renders the 🍺 marker when the target user
 * is an active supporter. Renders `null` (not an empty wrapper) when not a
 * supporter so layout siblings collapse around it.
 *
 * Also renders `null` when the supporter tier is hidden for this build
 * (production until v1.1 launch — see `SupporterUtils.isSupporterTierVisible`).
 * Gating here protects every render site automatically, including any
 * future ones.
 */
function SupporterBadge({isSupporter, size = 'medium'}: SupporterBadgeProps) {
  const {translate} = useLocalize();

  if (!SupporterUtils.isSupporterTierVisible()) {
    return null;
  }

  if (!isSupporter) {
    return null;
  }

  const label = translate('supporter.badgeAccessibilityLabel');

  return (
    <Text
      fontSize={SIZE_TO_FONT_SIZE[size]}
      accessibilityLabel={label}
      accessibilityRole="image">
      {SUPPORTER_BADGE_EMOJI}
    </Text>
  );
}

SupporterBadge.displayName = 'SupporterBadge';

type SupporterBadgeForUserProps = {
  /** ID of the user whose supporter status we want to render. */
  userID: UserID | undefined;

  /** Visual scale — `small` for friend lists, `medium` for profile views. */
  size?: SupporterBadgeSize;
};

/**
 * Onyx-aware convenience wrapper that resolves `isSupporter` for any user ID
 * (current user or a friend) and renders the base badge. Keeps the base
 * component free of state coupling so it remains snapshot-friendly.
 *
 * Short-circuits to `null` when the supporter tier is hidden for this build,
 * before touching Onyx — saves the listener subscription on production
 * builds where the badge can never render.
 */
function SupporterBadgeForUser({userID, size}: SupporterBadgeForUserProps) {
  if (!SupporterUtils.isSupporterTierVisible()) {
    return null;
  }

  return <SupporterBadgeForUserInner userID={userID} size={size} />;
}

function SupporterBadgeForUserInner({
  userID,
  size,
}: SupporterBadgeForUserProps) {
  const {auth} = useFirebase();
  const currentUserID = auth?.currentUser?.uid;
  const [userDataList] = useOnyx(ONYXKEYS.USER_DATA_LIST);
  const [privateData] = useOnyx(ONYXKEYS.USER_PRIVATE_DATA);

  const isSupporter = UserUtils.getUserIsSupporter(
    userID,
    userDataList,
    currentUserID,
    privateData,
  );

  return <SupporterBadge isSupporter={isSupporter} size={size} />;
}

SupporterBadgeForUser.displayName = 'SupporterBadgeForUser';

export default SupporterBadge;
export {SupporterBadgeForUser};
export type {
  SupporterBadgeSize,
  SupporterBadgeProps,
  SupporterBadgeForUserProps,
};
