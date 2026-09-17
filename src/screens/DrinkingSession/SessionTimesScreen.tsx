import React, {useState} from 'react';
import {View} from 'react-native';
import type {StackScreenProps} from '@react-navigation/stack';
import BottomActionBar from '@components/BottomActionBar';
import Button from '@components/Button';
import FormHelpMessage from '@components/FormHelpMessage';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import TimeOfDayInput from '@components/TimeOfDayInput';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import type {DrinkingSessionNavigatorParamList} from '@libs/Navigation/types';
import Navigation from '@libs/Navigation/Navigation';
import * as DS from '@userActions/DrinkingSession';
import CONST from '@src/CONST';
import type SCREENS from '@src/SCREENS';

type SessionTimesScreenProps = StackScreenProps<
  DrinkingSessionNavigatorParamList,
  typeof SCREENS.DRINKING_SESSION.SESSION_TIMES_SCREEN
>;

/**
 * Set a session's start and end time of day.
 *
 * Until Sessions v2 the only thing editable about a session's timing was its
 * DATE, shifted a whole day at a time (`SessionDateScreen`), so a session that
 * started half an hour before the user opened the app stayed wrong forever.
 * Both times here are absolute, which is what makes the `set_times` op they
 * produce safe to replay.
 *
 * The date is deliberately not editable here: it has its own screen, and the
 * hour and minute are read and written in the SESSION's timezone, so the
 * numbers shown are the ones on the session rather than converted ones.
 */
function SessionTimesScreen({route}: SessionTimesScreenProps) {
  const {sessionId, backTo} = route.params;
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const userData = useCurrentUserData();
  const session = DSUtils.getDrinkingSessionData(sessionId);

  const timezone =
    session?.timezone ??
    userData?.timezone?.selected ??
    CONST.DEFAULT_TIME_ZONE.selected;

  const [startTime, setStartTime] = useState(
    () => session?.start_time ?? Date.now(),
  );
  const [endTime, setEndTime] = useState(() => session?.end_time ?? Date.now());

  const isInvalid = endTime < startTime;

  const onGoBack = () => {
    if (backTo) {
      Navigation.goBack(backTo);
      return;
    }
    Navigation.goBack();
  };

  const onConfirm = () => {
    if (isInvalid) {
      return;
    }
    DS.setSessionTimes(sessionId, startTime, endTime);
    onGoBack();
  };

  return (
    <ScreenWrapper
      includeSafeAreaPaddingBottom={false}
      shouldShowOfflineIndicator={false}
      testID={SessionTimesScreen.displayName}>
      <HeaderWithBackButton
        title={translate('sessionTimesScreen.title')}
        onBackButtonPress={onGoBack}
      />
      <View style={[styles.flex1, styles.ph5]}>
        {!session ? (
          <Text style={styles.mb3}>
            {translate('sessionTimesScreen.error.load')}
          </Text>
        ) : (
          <>
            <Text style={styles.mb3}>
              {translate('sessionTimesScreen.prompt')}
            </Text>
            <TimeOfDayInput
              value={startTime}
              timezone={timezone}
              onChange={setStartTime}
              label={translate('sessionTimesScreen.start')}
              testIDPrefix="session-start-time"
            />
            <TimeOfDayInput
              value={endTime}
              timezone={timezone}
              onChange={setEndTime}
              label={translate('sessionTimesScreen.end')}
              testIDPrefix="session-end-time"
            />
            {!!isInvalid && (
              <FormHelpMessage
                message={translate('sessionTimesScreen.error.endBeforeStart')}
              />
            )}
          </>
        )}
      </View>
      <BottomActionBar>
        <Button
          large
          success
          isDisabled={!session || isInvalid}
          text={translate('common.save')}
          onPress={onConfirm}
          style={styles.bottomTabButton}
        />
      </BottomActionBar>
    </ScreenWrapper>
  );
}

SessionTimesScreen.displayName = 'SessionTimesScreen';
export default SessionTimesScreen;
