import React from 'react';
import {View} from 'react-native';
import useThemeStyles from '@hooks/useThemeStyles';
import useTheme from '@hooks/useTheme';
import Navigation from '@libs/Navigation/Navigation';
import ScreenWrapper from '@components/ScreenWrapper';
import ROUTES from '@src/ROUTES';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';

type NotFoundScreenProps = {
  onBackButtonPress?: () => void;
};

// eslint-disable-next-line rulesdir/no-negated-variables
function NotFoundScreen({onBackButtonPress}: NotFoundScreenProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();

  return (
    <ScreenWrapper
      testID={NotFoundScreen.displayName}
      style={styles.appContent}>
      <HeaderWithBackButton
        title={translate('notFoundScreen.title')}
        onBackButtonPress={() => Navigation.navigate(ROUTES.HOME)}
      />
      <View style={{backgroundColor: theme.appBG}}></View>
      {/* //   <FullPageNotFoundView shouldShow onBackButtonPress={onBackButtonPress} /> */}
    </ScreenWrapper>
  );
}

NotFoundScreen.displayName = 'NotFoundScreen';
export default NotFoundScreen;
