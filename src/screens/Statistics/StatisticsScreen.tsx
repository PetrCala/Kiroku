﻿import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import MainHeader from '@components/Header/MainHeader';
import Navigation from '@libs/Navigation/Navigation';
import ScreenWrapper from '@components/ScreenWrapper';

function StatisticsScreen() {
  return (
    <ScreenWrapper testID={StatisticsScreen.displayName}>
      <MainHeader
        headerText="Statistics"
        onGoBack={() => Navigation.goBack()}
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

StatisticsScreen.displayName = 'Statistics Screen';
export default StatisticsScreen;
