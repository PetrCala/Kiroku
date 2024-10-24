import React, {useState} from 'react';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import SelectionList from '@components/SelectionList';
import RadioListItem from '@components/SelectionList/RadioListItem';
import useInitialValue from '@hooks/useInitialValue';
import useLocalize from '@hooks/useLocalize';
import Navigation from '@libs/Navigation/Navigation';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import TIMEZONES from '@src/TIMEZONES';
import type {SelectedTimezone} from '@src/types/onyx/PersonalDetails';
import {StackScreenProps} from '@react-navigation/stack';
import {SettingsNavigatorParamList} from '@libs/Navigation/types';
import SCREENS from '@src/SCREENS';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {UserProps} from '@src/types/onyx';
import * as User from '@database/users';
import {useFirebase} from '@context/global/FirebaseContext';
import {Alert} from 'react-native';
import * as ErrorUtils from '@libs/ErrorUtils';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';

type TimezoneSelectScreenProps = StackScreenProps<
  SettingsNavigatorParamList,
  typeof SCREENS.SETTINGS.ACCOUNT.TIMEZONE_SELECT
>;
// type TimezoneSelectScreenProps = Pick<
//   WithCurrentUserPersonalDetailsProps,
//   'currentUserPersonalDetails'
// >;

/**
 * We add the current time to the key to fix a bug where the list options don't update unless the key is updated.
 */
const getKey = (text: string): string => `${text}-${new Date().getTime()}`;

// const getUserTimezone = (
//   currentUserPersonalDetails: ValueOf<
//     WithCurrentUserPersonalDetailsProps,
//     'currentUserPersonalDetails'
//   >,
// ) => currentUserPersonalDetails?.timezone ?? CONST.DEFAULT_TIME_ZONE;
const getUserTimezone = (userData: UserProps | undefined) =>
  userData?.private_data?.timezone ?? CONST.DEFAULT_TIME_ZONE;

function TimezoneSelectScreen({}: TimezoneSelectScreenProps) {
  const {translate} = useLocalize();
  const {db, auth} = useFirebase();
  const {userData} = useDatabaseData();
  const timezone = getUserTimezone(userData);
  const allTimezones = useInitialValue(() =>
    TIMEZONES.filter((tz: string) => !tz.startsWith('Etc/GMT')).map(
      (text: string) => ({
        text,
        keyForList: getKey(text),
        isSelected: text === timezone.selected,
      }),
    ),
  );
  const [timezoneInputText, setTimezoneInputText] = useState('');
  const [timezoneOptions, setTimezoneOptions] = useState(allTimezones);
  const [isLoading, setIsLoading] = useState(false);

  const saveSelectedTimezone = async ({text}: {text: string}) => {
    try {
      setIsLoading(true);
      await User.saveSelectedTimezone(
        db,
        auth.currentUser,
        text as SelectedTimezone,
      );
    } catch (error: any) {
      ErrorUtils.raiseAlert(error, translate('timezoneScreen.error.generic'));
    } finally {
      Navigation.goBack(ROUTES.SETTINGS_TIMEZONE);
      setIsLoading(false);
    }
  };

  const filterShownTimezones = (searchText: string) => {
    setTimezoneInputText(searchText);
    const searchWords = searchText.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    setTimezoneOptions(
      allTimezones.filter(tz =>
        searchWords.every(word =>
          tz.text
            .toLowerCase()
            .replace(/[^a-z0-9]/g, ' ')
            .includes(word),
        ),
      ),
    );
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
      <SelectionList
        headerMessage={
          timezoneInputText.trim() && !timezoneOptions.length
            ? translate('common.noResultsFound')
            : ''
        }
        textInputLabel={translate('timezoneScreen.timezone')}
        textInputValue={timezoneInputText}
        onChangeText={filterShownTimezones}
        onSelectRow={saveSelectedTimezone}
        shouldSingleExecuteRowSelect
        sections={[{data: timezoneOptions, isDisabled: timezone.automatic}]}
        initiallyFocusedOptionKey={
          timezoneOptions.find(tz => tz.text === timezone.selected)?.keyForList
        }
        showScrollIndicator
        shouldShowTooltips={false}
        ListItem={RadioListItem}
      />
    </ScreenWrapper>
  );
}

TimezoneSelectScreen.displayName = 'TimezoneSelectScreen';

export default TimezoneSelectScreen;
