import React, {useState, useEffect, useMemo} from 'react';
import {View, FlatList} from 'react-native';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {changeDateBySomeDays, dateStringToDate} from '@libs/DataHandling';
import UserOffline from '@components/UserOfflineModal';
import {useUserConnection} from '@context/global/UserConnectionContext';
import type {DrinkingSessionList} from '@src/types/onyx';
import type DrinkingSessionKeyValue from '@src/types/utils/databaseUtils';
import type {StackScreenProps} from '@react-navigation/stack';
import type {DayOverviewNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import Navigation from '@libs/Navigation/Navigation';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import CONST from '@src/CONST';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import {format} from 'date-fns';
import Button from '@components/Button';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Text from '@components/Text';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import useStyleUtils from '@hooks/useStyleUtils';
import useWindowDimensions from '@hooks/useWindowDimensions';
import type DeepValueOf from '@src/types/utils/DeepValueOf';
import DrinkingSessionOverview from '@components/DrinkingSessionOverview';
import AddSessionButton from '@components/DrinkingSessionOverview/AddSessionButton';

type ButtonItemData = {
  onPress: () => void;
  direction: DeepValueOf<typeof CONST.DIRECTION>;
};

type DayOverviewScreenProps = StackScreenProps<
  DayOverviewNavigatorParamList,
  typeof SCREENS.DAY_OVERVIEW.ROOT
>;

function DayOverviewScreen({route}: DayOverviewScreenProps) {
  const {date} = route.params;
  const {isOnline} = useUserConnection();
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const [loadingText] = useOnyx(ONYXKEYS.APP_LOADING_TEXT);
  const {windowWidth} = useWindowDimensions();
  const {drinkingSessionData} = useDatabaseData();
  const [currentDate, setCurrentDate] = useState<Date>(
    date ? dateStringToDate(date) : new Date(),
  );
  const [editMode, setEditMode] = useState<boolean>(false);
  const [dailyData, setDailyData] = useState<DrinkingSessionKeyValue[]>([]);

  // Monitor the combined data
  useEffect(() => {
    if (!drinkingSessionData) {
      setDailyData([]);
      return;
    }

    const relevantData = DSUtils.getSingleDayDrinkingSessions(
      currentDate,
      drinkingSessionData,
      false,
    ) as DrinkingSessionList;
    const newDailyData = Object.entries(relevantData).map(
      ([sessionId, session]) => {
        return {
          sessionId,
          session,
        };
      },
    );
    setDailyData(newDailyData);
  }, [currentDate, drinkingSessionData]);

  const changeDayButtons = useMemo(() => {
    const changeDay = (days: number) =>
      setCurrentDate(changeDateBySomeDays(currentDate, days));

    const buttonData: ButtonItemData[] = [
      {
        onPress: () => changeDay(-1),
        direction: CONST.DIRECTION.LEFT,
      },
      {
        onPress: () => changeDay(1),
        direction: CONST.DIRECTION.RIGHT,
      },
    ];

    return buttonData.map(item => (
      <Button
        key={item.direction as string}
        iconStyles={[
          StyleUtils.getDirectionStyle(item.direction),
          styles.w100,
          styles.alignItemsEnd,
        ]}
        icon={KirokuIcons.ArrowRight}
        style={[
          styles.bgTransparent,
          styles.bottomTabButton,
          styles.halfScreenWidth(windowWidth),
          styles.ph5,
        ]}
        onPress={item.onPress}
      />
    ));
  }, [currentDate, StyleUtils, windowWidth, styles]);

  if (!isOnline) {
    return <UserOffline />;
  }
  if (!date || !!loadingText) {
    return <FullScreenLoadingIndicator loadingText={loadingText} />;
  }

  return (
    <ScreenWrapper testID={DayOverviewScreen.displayName}>
      <HeaderWithBackButton
        onBackButtonPress={Navigation.goBack}
        customRightButton={
          <Button
            success
            onPress={() => setEditMode(!editMode)}
            text={translate(
              !editMode
                ? 'dayOverviewScreen.enterEditMode'
                : 'dayOverviewScreen.exitEditMode',
            )}
            style={[
              styles.buttonMedium,
              editMode ? styles.buttonSuccessPressed : styles.buttonSuccess,
            ]}
          />
        }
      />
      <View style={[styles.p2, styles.flex1]}>
        <Text
          style={[styles.textHeadlineH1, styles.alignSelfCenter, styles.mb2]}>
          {date
            ? format(currentDate, CONST.DATE.SHORT_DATE_FORMAT)
            : translate('dayOverviewScreen.loadingDate')}
        </Text>
        <FlatList
          data={dailyData}
          renderItem={({item}) => (
            <DrinkingSessionOverview
              sessionId={item.sessionId}
              session={item.session}
              isEditModeOn={editMode}
            />
          )}
          keyExtractor={item => String(item.sessionId)} // Use start time as id
          ListEmptyComponent={
            <Text style={[styles.noResultsText, styles.mb2]}>
              {translate('dayOverviewScreen.noDrinkingSessions')}
            </Text>
          }
          ListFooterComponent={
            <AddSessionButton
              currentDate={currentDate}
              isEditModeOn={editMode}
            />
          }
          ListFooterComponentStyle={[styles.alignSelfCenter, styles.mt3]}
        />
      </View>
      <View style={[styles.bottomTabBarContainer]}>{changeDayButtons}</View>
    </ScreenWrapper>
  );
}

DayOverviewScreen.displayName = 'Day Overview Screen';
export default DayOverviewScreen;
