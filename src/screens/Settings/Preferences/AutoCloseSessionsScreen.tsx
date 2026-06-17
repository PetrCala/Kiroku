import {View} from 'react-native';
import React from 'react';
import {useOnyx} from 'react-native-onyx';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import SelectionList from '@components/SelectionList';
import RadioListItem from '@components/SelectionList/RadioListItem';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import Navigation from '@libs/Navigation/Navigation';
import {getEffectiveAutoCloseHours} from '@libs/DrinkingSessionUtils';
import * as Preferences from '@userActions/Preferences';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

type AutoCloseOption = {
  /** The hours threshold, or `null` for the "Never" opt-out. */
  value: number | null;
  text: string;
  keyForList: string;
  isSelected: boolean;
};

function AutoCloseSessionsScreen() {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const preferences = useCurrentUserPreferences();
  const [config] = useOnyx(ONYXKEYS.CONFIG);

  const userPref = preferences?.auto_close_sessions_after_hours;
  const configDefault = config?.auto_close_default_hours;

  // When the user has no stored preference, show the resolved default as the
  // current selection without materializing it into their prefs. An explicit
  // `null` (Never) is shown as-is. `getEffectiveAutoCloseHours` returns a number
  // of hours or `null` (never).
  const selectedValue =
    userPref === undefined
      ? getEffectiveAutoCloseHours(undefined, configDefault)
      : userPref;

  const options: AutoCloseOption[] = [
    ...CONST.SESSION.AUTO_CLOSE.OPTIONS.map(hours => ({
      value: hours,
      text: translate('autoCloseSessionsScreen.hoursOption', {hours}),
      keyForList: String(hours),
      isSelected: selectedValue === hours,
    })),
    {
      value: null,
      text: translate('autoCloseSessionsScreen.never'),
      keyForList: CONST.SESSION.AUTO_CLOSE.NEVER,
      isSelected: selectedValue === null,
    },
  ];

  const onSelectRow = (value: number | null) => {
    Preferences.updateAutoCloseSessionsAfterHours(value);
  };

  return (
    <ScreenWrapper testID={AutoCloseSessionsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('autoCloseSessionsScreen.title')}
        shouldShowBackButton
        onBackButtonPress={() => Navigation.goBack()}
        onCloseButtonPress={() => Navigation.dismissModal()}
      />
      <View style={styles.flex1}>
        <Text style={[styles.mh5, styles.mv4]}>
          {translate('autoCloseSessionsScreen.description')}
        </Text>
        <SelectionList
          sections={[{data: options}]}
          ListItem={RadioListItem}
          onSelectRow={option => onSelectRow(option.value)}
          shouldSingleExecuteRowSelect
          initiallyFocusedOptionKey={
            options.find(option => option.isSelected)?.keyForList
          }
        />
      </View>
    </ScreenWrapper>
  );
}

AutoCloseSessionsScreen.displayName = 'AutoCloseSessionsScreen';
export default AutoCloseSessionsScreen;
