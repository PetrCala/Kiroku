﻿import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import MenuIcon from '../../components/Buttons/MenuIcon';
import commonStyles from '../../styles/commonStyles';
import MainHeader from '@components/Header/MainHeader';

type AchievementsScreenProps = {
  navigation: any;
};

const AchievementsScreen = (props: AchievementsScreenProps) => {
  const {navigation} = props;

  return (
    <View style={{flex: 1, backgroundColor: '#FFFF99'}}>
      <MainHeader
        headerText="Achievements"
        onGoBack={() => navigation.goBack()}
      />
      <View style={styles.mainContainer}>
        <Text style={styles.sectionText}>Coming soon...</Text>
      </View>
    </View>
  );
};

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
  },
});

export default AchievementsScreen;