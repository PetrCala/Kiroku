import React from 'react';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import SelectionList from '@components/SelectionList';
import RadioListItem from '@components/SelectionList/RadioListItem';
import useLocalize from '@hooks/useLocalize';
import Navigation from '@libs/Navigation/Navigation';
import * as App from '@userActions/App';
import CONST from '@src/CONST';

function LanguageScreen() {
  const {translate, preferredLocale} = useLocalize();

  const localesToLanguages = CONST.LANGUAGES.map(language => ({
    value: language,
    text: translate(`languageScreen.languages.${language}.label`),
    keyForList: language,
    isSelected: preferredLocale === language,
  }));

  return (
    <ScreenWrapper
      includeSafeAreaPaddingBottom={false}
      testID={LanguageScreen.displayName}>
      <HeaderWithBackButton
        title={translate('languageScreen.language')}
        onBackButtonPress={() => Navigation.goBack()}
      />
      <SelectionList
        sections={[{data: localesToLanguages}]}
        ListItem={RadioListItem}
        onSelectRow={language => App.setLocaleAndNavigate(language.value)}
        shouldSingleExecuteRowSelect
        initiallyFocusedOptionKey={
          localesToLanguages.find(locale => locale.isSelected)?.keyForList
        }
      />
    </ScreenWrapper>
  );
}

LanguageScreen.displayName = 'LanguageScreen';

export default LanguageScreen;
