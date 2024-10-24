import React from 'react';
import {Alert, View} from 'react-native';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import ScreenWrapper from '@components/ScreenWrapper';
import Switch from '@components/Switch';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type {SelectedTimezone, Timezone} from '@src/types/onyx/PersonalDetails';
import {StackScreenProps} from '@react-navigation/stack';
import {SettingsNavigatorParamList} from '@libs/Navigation/types';
import SCREENS from '@src/SCREENS';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import * as User from '@database/users';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import * as ErrorUtils from '@libs/ErrorUtils';

type TimezoneInitialScreenProps = StackScreenProps<
  SettingsNavigatorParamList,
  typeof SCREENS.SETTINGS.ACCOUNT.TIMEZONE
>;
// type TimezoneInitialScreenProps = WithCurrentUserPersonalDetailsProps;

function TimezoneInitialScreen({}: TimezoneInitialScreenProps) {
  const styles = useThemeStyles();
  const {db, auth} = useFirebase();
  const {userData} = useDatabaseData();
  const timezone: Timezone =
    userData?.private_data?.timezone ?? CONST.DEFAULT_TIME_ZONE;

  const {translate} = useLocalize();

  const currentTimezone = Intl.DateTimeFormat().resolvedOptions()
    .timeZone as SelectedTimezone;

  /**
   * Updates setting for automatic timezone selection.
   * Note: If we are updating automatically, we'll immediately calculate the user's timezone.
   */
  const updateAutomaticTimezone = async (isAutomatic: boolean) => {
    try {
      await User.updateAutomaticTimezone(
        db,
        auth.currentUser,
        isAutomatic,
        isAutomatic && !isEmptyObject(currentTimezone)
          ? currentTimezone
          : (timezone.selected as SelectedTimezone),
      );
    } catch (error: any) {
      ErrorUtils.raiseAlert(error, translate('timezoneScreen.error.generic'));
    }
  };

  return (
    <ScreenWrapper testID={TimezoneInitialScreen.displayName}>
      <HeaderWithBackButton
        title={translate('timezoneScreen.timezone')}
        onBackButtonPress={Navigation.goBack}
      />
      <View style={styles.flex1}>
        <View style={[styles.ph5]}>
          <Text style={[styles.mb5]}>
            {translate('timezoneScreen.isShownOnProfile')}
          </Text>
          <View
            style={[
              styles.flexRow,
              styles.mb5,
              styles.mr2,
              styles.alignItemsCenter,
              styles.justifyContentBetween,
            ]}>
            <Text style={[styles.flexShrink1, styles.mr2]}>
              {translate('timezoneScreen.getLocationAutomatically')}
            </Text>
            <Switch
              accessibilityLabel={translate(
                'timezoneScreen.getLocationAutomatically',
              )}
              isOn={!!timezone.automatic}
              onToggle={updateAutomaticTimezone}
            />
          </View>
        </View>
        <MenuItemWithTopDescription
          title={timezone.selected}
          description={translate('timezoneScreen.timezone')}
          shouldShowRightIcon
          disabled={timezone.automatic}
          onPress={() => Navigation.navigate(ROUTES.SETTINGS_TIMEZONE_SELECT)}
        />
      </View>
    </ScreenWrapper>
  );
}

TimezoneInitialScreen.displayName = 'TimezoneInitialScreen';

export default TimezoneInitialScreen;
