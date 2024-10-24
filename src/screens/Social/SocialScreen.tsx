import React, {useState} from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import commonStyles from '@src/styles/commonStyles';
import {TabView} from 'react-native-tab-view';
import FriendListScreen from './FriendListScreen';
import FriendRequestScreen from './FriendRequestScreen';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {getReceivedRequestsCount} from '@libs/FriendUtils';
import type {UserProps} from '@src/types/onyx';
import type {StackScreenProps} from '@react-navigation/stack';
import type SCREENS from '@src/SCREENS';
import type {SocialNavigatorParamList} from '@libs/Navigation/types';
import Navigation from '@libs/Navigation/Navigation';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import FriendRequestCounter from '@components/Social/FriendRequestCounter';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';

type SocialFooterButtonProps = {
  index: number;
  currentIndex: number;
  setImageIndex: (index: number) => void;
  source: any;
  label: string;
  infoNumberValue?: number;
};

const SocialFooterButton: React.FC<SocialFooterButtonProps> = ({
  index,
  currentIndex,
  setImageIndex,
  source,
  label,
  infoNumberValue,
}) => {
  return (
    <View style={styles.footerPartContainer}>
      <TouchableOpacity
        accessibilityRole="button"
        style={[
          styles.footerButton,
          currentIndex === index ? {backgroundColor: '#ebeb02'} : {},
        ]}
        onPress={() => setImageIndex(index)}>
        <View
          style={
            infoNumberValue && infoNumberValue > 0
              ? [styles.imageContainer, styles.extraSpacing]
              : styles.imageContainer
          }>
          <Image source={source} style={styles.footerImage} />
          <FriendRequestCounter count={infoNumberValue} />
        </View>
        <Text style={styles.footerText}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
};

type SocialScreenProps = StackScreenProps<
  SocialNavigatorParamList,
  typeof SCREENS.SOCIAL.ROOT
>;

type RouteType = {
  key: string;
  title: string;
  userData: UserProps | undefined;
};

function SocialScreen({route}: SocialScreenProps) {
  const {userData} = useDatabaseData();
  const {translate} = useLocalize();
  const [routes] = useState([
    {key: 'friendList', title: 'Friend List', userData: userData},
    // {key: 'friendSearch', title: 'Friend Search', userData: userData},
    {key: 'friendRequests', title: 'Friend Requests', userData: userData},
  ]);

  const [index, setIndex] = useState<number>(0);

  const renderScene = ({route}: {route: RouteType}) => {
    if (!userData) {
      return null;
    }
    switch (route.key) {
      case 'friendList':
        return <FriendListScreen />;
      // case 'friendSearch':
      //   return <FriendSearchScreen />;
      case 'friendRequests':
        return <FriendRequestScreen />;
      default:
        return null;
    }
  };

  const footerButtons = [
    {
      index: 0,
      source: KirokuIcons.FriendList,
      label: 'Friend List',
    },
    // {
    //   index: 1,
    //   source: KirokuIcons.Search,
    //   label: 'Find New Friends',
    // },
    {
      index: 1,
      source: KirokuIcons.AddUser,
      label: 'Friend Requests',
      infoNumberValue: getReceivedRequestsCount(userData?.friend_requests),
    },
  ];

  return (
    <ScreenWrapper testID={SocialScreen.displayName}>
      <HeaderWithBackButton
        title={translate('socialScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      <TabView
        navigationState={{index, routes}}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{width: Dimensions.get('window').width}}
        swipeEnabled={true}
        tabBarPosition="bottom"
        renderTabBar={() => null} // Do not render the default tab bar
      />
      <View style={commonStyles.mainFooter}>
        {footerButtons.map(button => (
          <SocialFooterButton
            key={button.index}
            index={button.index}
            currentIndex={index}
            setImageIndex={setIndex}
            source={button.source}
            label={button.label}
            infoNumberValue={button.infoNumberValue}
          />
        ))}
      </View>
    </ScreenWrapper>
  );
}

const screenWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
  sectionText: {
    fontSize: 20,
    color: 'black',
    fontWeight: 'bold',
    margin: 10,
    textAlign: 'center',
  },
  scrollViewContainer: {
    flex: 1,
    // justifyContent: 'center',
  },
  friendList: {
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: 3,
  },
  friendOverviewContainer: {
    width: '80%',
    flexDirection: 'row',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'black',
    borderRadius: 5,
    margin: 2,
    padding: 2,
  },
  friendText: {
    color: 'black',
    fontSize: 13,
    fontWeight: '400',
  },
  footerPartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerButton: {
    width: screenWidth / 2,
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerImageWrapper: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 3,
    backgroundColor: '#ebeb02',
  },
  imageContainer: {
    flexDirection: 'row',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  extraSpacing: {
    marginLeft: 30, // 20 + 10
  },
  friendRequestCounter: {
    width: 20,
    height: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    marginLeft: 10,
    marginBottom: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'black',
  },
  friendRequestCounterValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  footerImage: {
    width: 25,
    height: 25,
    // padding: 5,
    // tintColor: '#ebeb02',
    // tintColor: '#000',
    tintColor: 'gray',
  },
  footerText: {
    fontSize: 12,
    color: 'gray',
  },
});

SocialScreen.displayName = 'SocialScreen';
export default SocialScreen;
