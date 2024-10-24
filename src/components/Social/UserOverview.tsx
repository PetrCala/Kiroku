import {Image, StyleSheet, Text, View} from 'react-native';
import {useFirebase} from '../../context/global/FirebaseContext';
import ProfileImage from '@components/ProfileImage';
import {getTimestampAge} from '@libs/TimeUtils';
import commonStyles from '@src/styles/commonStyles';
import {formatDateToTime, timestampToDate} from '@libs/DataHandling';
import type {Profile, UserStatus} from '@src/types/onyx';
import DSUtils from '@libs/DrinkingSessionUtils';
import DrinkData from '@libs/DrinkData';
import _, {get} from 'lodash';

type UserOverviewProps = {
  userID: string;
  profileData: Profile;
  userStatusData: UserStatus;
};

const UserOverview: React.FC<UserOverviewProps> = ({
  userID,
  profileData,
  userStatusData,
}) => {
  const {storage} = useFirebase();
  const {last_online, latest_session, latest_session_id} = userStatusData;
  // const activeNow = isRecent(last_online);
  const inSession = latest_session?.ongoing;
  const lastSessionEndTime = get(latest_session, 'end_time', null);
  const sessionEndTimeVerbose = getTimestampAge(
    lastSessionEndTime,
    false,
    true,
  );
  const shouldDisplaySessionInfo =
    inSession && !DSUtils.sessionIsExpired(latest_session);
  // const sessionLength = calculateSessionLength(latest_session, true);
  const sessionStartTime = latest_session?.start_time
    ? formatDateToTime(timestampToDate(latest_session?.start_time))
    : null;
  const mostCommonDrink =
    DSUtils.determineSessionMostCommonDrink(latest_session);
  const mostCommonDrinkIcon = DrinkData.find(
    drink => drink.key === mostCommonDrink,
  )?.icon;

  return (
    <View key={userID + '-container'} style={styles.userOverviewContainer}>
      <View key={userID + '-left-container'} style={styles.leftContainer}>
        <View key={userID + '-profile'} style={styles.userOverviewProfile}>
          <View style={styles.imageContainer}>
            <ProfileImage
              key={userID + '-profile-icon'}
              storage={storage}
              userID={userID}
              downloadPath={profileData.photo_url}
              style={styles.userOverviewImage}
            />
          </View>
          <View
            key={userID + 'info'}
            style={
              // shouldDisplaySessionInfo ?
              // : [styles.userInfoContainer, styles.centerUserInfo]
              [styles.userInfoContainer, styles.centerUserInfo]
            }>
            <Text
              key={userID + '-nickname'}
              style={[styles.userOverviewText, {flexShrink: 1}]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {profileData.display_name}
            </Text>
          </View>
        </View>
      </View>
      <View key={userID + '-right-container'} style={styles.rightContainer}>
        {/* ? `In session:\n${drinksThisSession} ${mostCommonDrink}` */}
        {inSession && shouldDisplaySessionInfo ? (
          <>
            <View style={commonStyles.flexRow}>
              <Text
                key={userID + '-status-info'}
                style={[styles.userDetailsText, styles.rightContainerText]}>
                {`In session${mostCommonDrinkIcon ? ':' : ''}`}
              </Text>
              {mostCommonDrinkIcon && (
                <Image
                  source={mostCommonDrinkIcon}
                  style={styles.userDetailsIcon}
                />
              )}
            </View>
            <Text
              key={userID + '-status-time'}
              style={[styles.userDetailsText, styles.rightContainerText]}>
              {`From: ${sessionStartTime}`}
            </Text>
          </>
        ) : (
          <Text
            key={userID + '-status'}
            style={[styles.userDetailsText, styles.rightContainerText]}>
            {!_.isEmpty(sessionEndTimeVerbose)
              ? `${sessionEndTimeVerbose}\nsober`
              : inSession
                ? `Session started:\n${sessionStartTime}`
                : 'No sessions yet'}
          </Text>
        )}
      </View>
    </View>
  );
};

export default UserOverview;

const styles = StyleSheet.create({
  userOverviewContainer: {
    width: '100%',
    height: 80,
    flexDirection: 'row',
    padding: 5,
  },
  leftContainer: {
    flexDirection: 'column',
    width: '70%',
    height: '100%',
  },
  rightContainer: {
    flexDirection: 'column',
    width: '30%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-end',
    padding: 5,
    paddingRight: 7,
  },
  userOverviewProfile: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  imageContainer: {
    width: '30%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userOverviewImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  userInfoContainer: {
    height: '100%',
    width: '70%',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    marginTop: 5,
  },
  centerUserInfo: {
    justifyContent: 'center',
    marginTop: -5, // 5 is the margin of the text
  },
  userOverviewText: {
    color: 'black',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 5,
    marginBottom: 3,
    marginTop: 5,
  },
  userDetailsText: {
    color: 'black',
    fontSize: 12,
    textAlign: 'center',
    padding: 2,
  },
  userDetailsIcon: {
    width: 15,
    height: 15,
  },
  leftContainerText: {},
  rightContainerText: {
    textAlign: 'center',
    color: '#333',
  },
});
