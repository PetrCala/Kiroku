import React, {useState} from 'react';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import useLocalize from '@hooks/useLocalize';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {StackScreenProps} from '@react-navigation/stack';
import type {SettingsNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import * as User from '@userActions/User';
import {useFirebase} from '@context/global/FirebaseContext';
import * as ErrorUtils from '@libs/ErrorUtils';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import TimezoneSelect from '@components/TimezoneSelect';
import useCurrentUserData from '@hooks/useCurrentUserData';
import CONST from '@src/CONST';
import ERRORS from '@src/ERRORS';

type TimezoneSelectScreenProps = StackScreenProps<
  SettingsNavigatorParamList,
  typeof SCREENS.SETTINGS.ACCOUNT.TIMEZONE_SELECT
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TimezoneSelectScreen({route}: TimezoneSelectScreenProps) {
  const {translate} = useLocalize();
  const {db, auth} = useFirebase();
  const userData = useCurrentUserData();
  const timezone = userData?.timezone ?? CONST.DEFAULT_TIME_ZONE;
  const [isLoading, setIsLoading] = useState(false);

  const saveSelectedTimezone = (tz: SelectedTimezone) => {
    (async () => {
      try {
        setIsLoading(true);
        await User.saveSelectedTimezone(db, auth.currentUser, tz);
      } catch (error) {
        ErrorUtils.raiseAppError(ERRORS.USER.TIMEZONE_UPDATE_FAILED, error);
      } finally {
        Navigation.goBack(ROUTES.SETTINGS_TIMEZONE);
        setIsLoading(false);
      }
    })();
  };

  if (isLoading) {
    return (
      <FullScreenLoadingIndicator
        loadingText={translate('timezoneScreen.saving')}
      />
    );
  }

  return (
    <ScreenWrapper
      includeSafeAreaPaddingBottom={false}
      testID={TimezoneSelectScreen.displayName}>
      <HeaderWithBackButton
        title={translate('timezoneScreen.timezone')}
        onBackButtonPress={() => Navigation.goBack(ROUTES.SETTINGS_TIMEZONE)}
      />
      <TimezoneSelect
        initialTimezone={timezone}
        onSelectedTimezone={saveSelectedTimezone}
      />
    </ScreenWrapper>
  );
}

TimezoneSelectScreen.displayName = 'TimezoneSelectScreen';

export default TimezoneSelectScreen;
