import React from 'react';
import {Dimensions, StyleSheet, Text, View} from 'react-native';
import MenuIcon from '../Buttons/MenuIcon';
import commonStyles from '@src/styles/commonStyles';
import DismissKeyboard from '@components/Keyboard/DismissKeyboard';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import CONST from '@src/CONST';

type HeaderProps = {
  headerText: string;
  onGoBack: () => void;
  rightSideComponent?: React.ReactNode;
};

const MainHeader: React.FC<HeaderProps> = ({
  headerText,
  onGoBack,
  rightSideComponent,
}) => {
  return (
    <View style={commonStyles.headerContainer}>
      <MenuIcon
        iconId="header-icon"
        iconSource={KirokuIcons.ArrowBack}
        containerStyle={commonStyles.backArrowContainer}
        iconStyle={commonStyles.backArrow}
        onPress={() => onGoBack()}
      />
      <View style={commonStyles.headerRightContainer}>
        {rightSideComponent ? (
          rightSideComponent
        ) : (
          <Text
            style={styles.sectionText}
            numberOfLines={1}
            ellipsizeMode="tail">
            {headerText}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionText: {
    fontSize: 20,
    color: 'black',
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 10,
    marginRight: 10,
  },
});

export default MainHeader;
