import {View} from 'react-native';
import ProfileImage from '@components/ProfileImage';
import {SupporterBadgeForUser} from '@components/SupporterBadge';
import {getTimestampAge} from '@libs/TimeUtils';
import commonStyles from '@src/styles/commonStyles';
import type {Profile, UserStatus} from '@src/types/onyx';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import DrinkData from '@libs/DrinkData';
import useThemeStyles from '@hooks/useThemeStyles';
import DateUtils from '@libs/DateUtils';
import type {Timezone} from '@src/types/onyx/UserData';
import Text from '@components/Text';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import useTheme from '@hooks/useTheme';
import useLocalize from '@hooks/useLocalize';

type UserOverviewProps = {
  userID: string;
  profileData: Profile;
  userStatusData: UserStatus;
  timezone?: Timezone;
  /** The friend hid their drinking data, so `userStatusData` is empty and
   *  carries no session/presence info. Show a neutral "Private" marker instead
   *  of any activity status. */
  isPrivate?: boolean;
};

function UserOverview({
  userID,
  profileData,
  userStatusData,
  timezone,
  isPrivate = false,
}: UserOverviewProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {latest_session} = userStatusData;
  // const activeNow = isRecent(last_online);
  const inSession = latest_session?.ongoing;
  const lastSessionEndTime = latest_session?.end_time ?? null;
  const sessionEndTimeVerbose = getTimestampAge(
    lastSessionEndTime,
    false,
    true,
  );
  const shouldDisplaySessionInfo =
    inSession && !DSUtils.sessionIsExpired(latest_session);
  // const sessionLength = calculateSessionLength(latest_session, true);
  const sessionStartTime = latest_session?.start_time
    ? DateUtils.getLocalizedTime(latest_session.start_time, timezone?.selected)
    : null; // Show the time in the current user's timezone
  const mostCommonDrink =
    DSUtils.determineSessionMostCommonDrink(latest_session);
  const mostCommonDrinkIcon = DrinkData.find(
    drink => drink.key === mostCommonDrink,
  )?.icon;

  function getSessionStatus(): string {
    if (sessionEndTimeVerbose && sessionEndTimeVerbose.trim().length > 0) {
      return `${sessionEndTimeVerbose}\n${translate('userOverview.sober').toLowerCase()}`;
    }
    if (inSession) {
      return `${translate('userOverview.sessionStarted')}:\n${sessionStartTime}`;
    }
    return translate('userOverview.noSessionsYet');
  }

  // Right-hand status content, three mutually exclusive states. A hidden friend
  // (`isPrivate`) has no `user_status`, so render a neutral "Private" marker —
  // never `getSessionStatus()`'s "no sessions yet", which would misrepresent a
  // hidden history as an empty one.
  function renderRightContent() {
    if (isPrivate) {
      return (
        <>
          <Icon small src={KirokuIcons.Lock} fill={theme.textSupporting} />
          <Text
            style={[
              styles.textLabelSupporting,
              styles.textAlignCenter,
              styles.ml1,
            ]}>
            {translate('userOverview.private')}
          </Text>
        </>
      );
    }
    if (inSession && shouldDisplaySessionInfo) {
      return (
        <View style={styles.flexColumn}>
          <View style={commonStyles.flexRow}>
            <Text
              key={`${userID}-status-info`}
              style={[styles.textLabelSupporting, styles.textAlignCenter]}>
              {`${translate('userOverview.inSession')}${mostCommonDrinkIcon ? ':' : ''}`}
            </Text>
            {mostCommonDrinkIcon && (
              <Icon
                small
                src={mostCommonDrinkIcon}
                fill={theme.textSupporting}
              />
            )}
          </View>
          <Text
            key={`${userID}-status-time`}
            style={[
              styles.textLabelSupporting,
              styles.textAlignCenter,
              styles.mt1,
            ]}>
            {`${translate('userOverview.from')}: ${sessionStartTime}`}
          </Text>
        </View>
      );
    }
    return (
      <Text
        key={`${userID}-status`}
        style={[styles.textLabelSupporting, styles.textAlignCenter]}>
        {getSessionStatus()}
      </Text>
    );
  }

  return (
    <View key={`${userID}-container`} style={styles.userOverviewContainer}>
      <View
        key={`${userID}-left-container`}
        style={styles.userOverviewLeftContent}>
        <ProfileImage
          key={`${userID}-profile-icon`}
          photoUrl={profileData.photo_url}
          style={styles.avatarLarge}
        />
        <Text
          key={`${userID}-nickname`}
          style={[styles.headerText, styles.ml3, styles.flexShrink1]}
          numberOfLines={1}
          ellipsizeMode="tail">
          {profileData.display_name}
        </Text>
        <View style={styles.ml1}>
          <SupporterBadgeForUser userID={userID} size="small" />
        </View>
      </View>
      <View
        key={`${userID}-right-container`}
        style={[styles.flexRow, styles.alignItemsCenter]}>
        {renderRightContent()}
      </View>
    </View>
  );
}

export default UserOverview;
