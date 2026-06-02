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
import Navigation from '@libs/Navigation/Navigation';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as Preferences from '@userActions/Preferences';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Theme} from '@src/types/onyx';
import ERRORS from '@src/ERRORS';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';

function ThemeScreen() {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const [preferredTheme] = useOnyx(ONYXKEYS.PREFERRED_THEME);
  const [isLoading, setIsLoading] = React.useState(false);
  const {DEFAULT, FALLBACK, ...themes} = CONST.THEME;
  const localesToThemes = Object.values(themes).map(theme => ({
    value: theme,
    text: translate(`themeScreen.themes.${theme}.label`),
    keyForList: theme,
    isSelected: (preferredTheme ?? CONST.THEME.DEFAULT) === theme,
  }));

  const onSelectRow = (theme: Theme) => {
    (async () => {
      try {
        setIsLoading(true);
        await Preferences.updateTheme(theme);
      } catch (error) {
        ErrorUtils.raiseAppError(ERRORS.USER.THEME_UPDATE_FAILED, error);
      } finally {
        setIsLoading(false);
      }
    })();
  };

  return (
    <ScreenWrapper testID={ThemeScreen.displayName}>
      <HeaderWithBackButton
        title={translate('themeScreen.theme')}
        shouldShowBackButton
        onBackButtonPress={() => Navigation.goBack()}
        onCloseButtonPress={() => Navigation.dismissModal()}
      />

      {isLoading ? (
        <FullScreenLoadingIndicator
          loadingText={translate('themeScreen.loading')}
        />
      ) : (
        <View style={styles.flex1}>
          <Text style={[styles.mh5, styles.mv4]}>
            {translate('themeScreen.chooseThemeBelowOrSync')}
          </Text>

          <SelectionList
            sections={[{data: localesToThemes}]}
            ListItem={RadioListItem}
            onSelectRow={theme => onSelectRow(theme.value)}
            shouldSingleExecuteRowSelect
            initiallyFocusedOptionKey={
              localesToThemes.find(theme => theme.isSelected)?.keyForList
            }
          />
        </View>
      )}
    </ScreenWrapper>
  );
}

ThemeScreen.displayName = 'ThemeScreen';
export default ThemeScreen;
