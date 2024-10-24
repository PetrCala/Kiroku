import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Navigation from '@libs/Navigation/Navigation';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';

function AchievementsScreen() {
  const {translate} = useLocalize();

  return (
    <ScreenWrapper testID={AchievementsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('achievementsScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      <View style={styles.mainContainer}>
        <Text style={styles.sectionText}>Coming soon...</Text>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  sectionText: {
    fontSize: 20,
    color: 'black',
    fontWeight: 'bold',
    margin: 10,
    textAlign: 'center',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#ffff99',
  },
});

AchievementsScreen.displayName = 'Achievements Screen';
export default AchievementsScreen;
