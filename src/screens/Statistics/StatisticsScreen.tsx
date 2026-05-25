import React from 'react';
import {View} from 'react-native';
import Navigation from '@libs/Navigation/Navigation';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';

function StatisticsScreen() {
  const {translate} = useLocalize();
  const styles = useThemeStyles();

  return (
    <ScreenWrapper testID={StatisticsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('statisticsScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      <View style={styles.flex1}>
        <Text style={[styles.textLarge, styles.textAlignCenter]}>
          {translate('statisticsScreen.comingSoon')}
        </Text>
      </View>
    </ScreenWrapper>
  );
}

StatisticsScreen.displayName = 'Statistics Screen';
export default StatisticsScreen;
