import {ScrollView, StyleSheet, Text, View} from 'react-native';
import MenuIcon from '@components/Buttons/MenuIcon';
import {
  formatDateToDay,
  formatDateToTime,
  getLastDrinkAddedTime,
  sumAllUnits,
  sumAllDrinks,
  sumDrinksOfSingleType,
  timestampToDate,
  unitsToColors,
} from '@libs/DataHandling';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import BasicButton from '@components/Buttons/BasicButton';
import type {DrinkingSession} from '@src/types/onyx';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import type {StackScreenProps} from '@react-navigation/stack';
import SCREENS from '@src/SCREENS';
import type {DrinkingSessionNavigatorParamList} from '@libs/Navigation/types';
import {useEffect, useState} from 'react';
import DSUtils from '@libs/DrinkingSessionUtils';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';

const SessionDataItem = ({
  heading,
  data,
  index,
  sessionColor,
}: {
  heading: string;
  data: any;
  index: number;
  sessionColor?: string; // Optional property for sessionColor
}) => (
  <View
    style={[
      styles.sessionDataContainer,
      {backgroundColor: index % 2 === 0 ? '#FFFFbd' : 'white'},
    ]}>
    <Text style={styles.sessionDataHeading}>{heading}</Text>
    {sessionColor ? (
      // Render the colored rectangle when sessionColor is present
      <View
        style={[styles.sessionColorMarker, {backgroundColor: sessionColor}]}
      />
    ) : (
      // Else render the text
      <Text style={styles.sessionDataText}>{data}</Text>
    )}
  </View>
);

type SessionSummaryScreenProps = StackScreenProps<
  DrinkingSessionNavigatorParamList,
  typeof SCREENS.DRINKING_SESSION.SUMMARY
>;

function SessionSummaryScreen({route}: SessionSummaryScreenProps) {
  const {sessionId} = route.params;
  const {preferences, drinkingSessionData} = useDatabaseData();
  if (!preferences) {
    return null;
  } // Careful when writing hooks after this line
  const [session, setSession] = useState<DrinkingSession>(
    DSUtils.extractSessionOrEmpty(sessionId, drinkingSessionData),
  );
  // Drinks info
  const totalDrinks = sumAllDrinks(session.drinks);
  const totalUnits = sumAllUnits(session.drinks, preferences.drinks_to_units);
  const drinkSums = {
    small_beer: sumDrinksOfSingleType(session.drinks, 'small_beer'),
    beer: sumDrinksOfSingleType(session.drinks, 'beer'),
    wine: sumDrinksOfSingleType(session.drinks, 'wine'),
    weak_shot: sumDrinksOfSingleType(session.drinks, 'weak_shot'),
    strong_shot: sumDrinksOfSingleType(session.drinks, 'strong_shot'),
    cocktail: sumDrinksOfSingleType(session.drinks, 'cocktail'),
    other: sumDrinksOfSingleType(session.drinks, 'other'),
  };
  // Time info
  const sessionStartDate = timestampToDate(session.start_time);
  const sessionEndDate = timestampToDate(session.end_time);
  const sessionDay = formatDateToDay(sessionStartDate);
  const sessionStartTime = formatDateToTime(sessionStartDate);
  const sessionEndTime = formatDateToTime(sessionEndDate);
  const sessionLength = DSUtils.calculateSessionLength(session, false);
  // Figure out last drink added
  let lastDrinkAdded: string;
  const lastDrinkEditTimestamp = getLastDrinkAddedTime(session);
  if (!lastDrinkEditTimestamp) {
    lastDrinkAdded = 'Unknown';
  } else {
    const lastDrinkAddedDate = timestampToDate(lastDrinkEditTimestamp);
    lastDrinkAdded = formatDateToTime(lastDrinkAddedDate);
  }

  const onEditSessionPress = (sessionId: string) => {
    Navigation.navigate(ROUTES.DRINKING_SESSION_LIVE.getRoute(sessionId));
  };

  const handleBackPress = () => {
    const screenBeforeSummaryScreen = Navigation.getLastScreenName(true);
    if (screenBeforeSummaryScreen === SCREENS.DAY_OVERVIEW.ROOT) {
      Navigation.goBack();
    } else {
      Navigation.navigate(ROUTES.HOME);
    }
  };

  const generalData = [
    {heading: 'Units:', data: totalUnits.toString()},
    {heading: 'Date:', data: sessionDay},
    {
      heading: 'Start time:',
      data: sessionLength === 0 ? '-' : sessionStartTime,
    },
    {
      heading: 'Last drink added:',
      data: sessionLength === 0 ? '-' : lastDrinkAdded,
    },
    {heading: 'End time:', data: sessionLength === 0 ? '-' : sessionEndTime},
  ];

  const drinkData = [
    {heading: 'Drinks:', data: totalDrinks.toString()},
    {heading: 'Small Beer:', data: drinkSums.small_beer.toString()},
    {heading: 'Beer:', data: drinkSums.beer.toString()},
    {heading: 'Wine:', data: drinkSums.wine.toString()},
    {heading: 'Weak Shot:', data: drinkSums.weak_shot.toString()},
    {heading: 'Strong Shot:', data: drinkSums.strong_shot.toString()},
    {heading: 'Cocktail:', data: drinkSums.cocktail.toString()},
    {heading: 'Other:', data: drinkSums.other.toString()},
  ];

  const otherData = [
    {heading: 'Blackout:', data: session.blackout ? 'Yes' : 'No'},
    {heading: 'Note:', data: session.note},
  ];

  const sessionColor = session.blackout
    ? 'black'
    : unitsToColors(totalUnits, preferences.units_to_colors);

  useEffect(() => {
    const newSession = DSUtils.extractSessionOrEmpty(
      sessionId,
      drinkingSessionData,
    );
    setSession(newSession);
  }, [drinkingSessionData]);

  return (
    <ScreenWrapper testID={SessionSummaryScreen.displayName}>
      <HeaderWithBackButton
        onBackButtonPress={handleBackPress}
        customRightButton={
          session.ongoing ? null : (
            <MenuIcon
              iconId="edit-session-icon"
              iconSource={KirokuIcons.Edit}
              containerStyle={styles.menuIconContainer}
              iconStyle={styles.menuIcon}
              onPress={() => onEditSessionPress(sessionId)} // Use keyextractor to load id here
            />
          )
        }
      />
      <ScrollView style={styles.scrollView}>
        <View style={styles.sessionInfoContainer}>
          <Text style={styles.sessionInfoText}>Session Summary</Text>
        </View>

        <View style={styles.sessionSectionContainer}>
          <Text style={styles.sessionDataContainerHeading}>General</Text>
          <SessionDataItem
            key="sessionColor"
            heading="Session Color"
            data={sessionColor}
            index={generalData.length}
            sessionColor={sessionColor}
          />
          {generalData.map((item, index) => (
            <SessionDataItem
              key={index}
              heading={item.heading}
              data={item.data}
              index={index}
            />
          ))}
        </View>

        <View style={styles.sessionSectionContainer}>
          <Text style={styles.sessionDataContainerHeading}>
            Drinks consumed
          </Text>
          {drinkData.map((item, index) => (
            <SessionDataItem
              key={index}
              heading={item.heading}
              data={item.data}
              index={index}
            />
          ))}
        </View>

        <View style={styles.sessionSectionContainer}>
          <Text style={styles.sessionDataContainerHeading}>Other</Text>
          {otherData.map((item, index) => (
            <SessionDataItem
              key={index}
              heading={item.heading}
              data={item.data}
              index={index}
            />
          ))}
        </View>
      </ScrollView>
      <View style={styles.confirmButtonContainer}>
        <BasicButton
          text="Confirm"
          buttonStyle={styles.confirmButton}
          textStyle={styles.confirmButtonText}
          onPress={handleBackPress}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    width: 25,
    height: 25,
  },
  scrollView: {
    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: '#FFFF99',
  },
  sessionInfoContainer: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
  },
  sessionInfoText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 5,
    color: 'black',
    alignSelf: 'center',
    alignContent: 'center',
    padding: 10,
  },
  sessionSectionContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderColor: '#000',
  },
  sessionDataContainerHeading: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#4a4b4d',
    fontStyle: 'italic',
    alignSelf: 'center',
    padding: 10,
  },
  sessionDataContainer: {
    width: '100%',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    // borderWidth: 1,
    // borderColor: 'grey',
    padding: 7,
  },
  sessionDataHeading: {
    marginLeft: 7,
    fontSize: 14,
    fontWeight: 'bold',
    color: 'black',
  },
  sessionDataText: {
    fontSize: 14,
    color: 'black',
    fontWeight: '400',
    marginRight: 5,
    marginLeft: 10,
    overflow: 'hidden',
  },
  sessionColorMarker: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#D3D3D3',
    borderRadius: 5,
    marginRight: 5,
  },
  confirmButtonContainer: {
    width: '100%',
    height: '10%',
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#FFFF99',
    padding: 5,
  },
  confirmButton: {
    width: '50%',
    height: '90%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#fcf50f',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
  },
  confirmButtonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

SessionSummaryScreen.displayName = 'Session Summary Screen';
export default SessionSummaryScreen;
