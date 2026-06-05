import React from 'react';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import useLocalize from '@hooks/useLocalize';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {StackScreenProps} from '@react-navigation/stack';
import type {SettingsNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import * as UserData from '@userActions/UserData';
import TimezoneSelect from '@components/TimezoneSelect';
import useCurrentUserData from '@hooks/useCurrentUserData';
import CONST from '@src/CONST';

type TimezoneSelectScreenProps = StackScreenProps<
  SettingsNavigatorParamList,
  typeof SCREENS.SETTINGS.ACCOUNT.TIMEZONE_SELECT
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TimezoneSelectScreen({route}: TimezoneSelectScreenProps) {
  const {translate} = useLocalize();
  const userData = useCurrentUserData();
  const timezone = userData?.timezone ?? CONST.DEFAULT_TIME_ZONE;

  const saveSelectedTimezone = (tz: SelectedTimezone) => {
    UserData.saveSelectedTimezone(tz);
    Navigation.goBack(ROUTES.SETTINGS_TIMEZONE);
  };

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
