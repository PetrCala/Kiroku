import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import {
  getLastDrinkAddedTime,
  sumDrinksOfSingleType,
  convertUnitsToColors,
} from '@libs/DataHandling';
import useLocalize from '@hooks/useLocalize';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import type {DrinkingSession} from '@src/types/onyx';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import type {StackScreenProps} from '@react-navigation/stack';
import CONST from '@src/CONST';
import SCREENS from '@src/SCREENS';
import Text from '@components/Text';
import type {DrinkingSessionNavigatorParamList} from '@libs/Navigation/types';
import {useCallback, useEffect, useMemo, useState} from 'react';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import * as DS from '@userActions/DrinkingSession';
import DateUtils from '@libs/DateUtils';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import Button from '@components/Button';
import useThemeStyles from '@hooks/useThemeStyles';
import ScrollView from '@components/ScrollView';
import MenuItem from '@components/MenuItem';
import Section from '@components/Section';
import type {TranslationPaths} from '@src/languages/types';
import MenuItemGroup from '@components/MenuItemGroup';
import _ from 'lodash';

type DrinkMenuItem = {
  key: TranslationPaths;
  val: number;
};

type MenuData = {
  titleKey?: TranslationPaths;
  description?: string;
  shouldHide?: boolean;
  rightComponent?: React.ReactNode;
  additionalStyles?: StyleProp<ViewStyle>;
};

type Menu = {
  sectionTranslationKey: TranslationPaths;
  items: MenuData[];
};
type SessionSummaryScreenProps = StackScreenProps<
  DrinkingSessionNavigatorParamList,
  typeof SCREENS.DRINKING_SESSION.SUMMARY
>;

function SessionSummaryScreen({route}: SessionSummaryScreenProps) {
  const {sessionId} = route.params;
  const {preferences, drinkingSessionData} = useDatabaseData();
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const [session, setSession] = useState<DrinkingSession>(
    DSUtils.extractSessionOrEmpty(sessionId, drinkingSessionData),
  );
  // Drinks info
  const totalUnits = DSUtils.calculateTotalUnits(
    session.drinks,
    preferences?.drinks_to_units,
    true,
  );
  // Time info
  const sessionDay = DateUtils.getLocalizedDay(
    session.start_time,
    session?.timezone,
  );
  const sessionStartTime = DateUtils.getLocalizedTime(
    session.start_time,
    session?.timezone,
  );
  const sessionEndTime = DateUtils.getLocalizedTime(
    session?.end_time,
    session?.timezone,
  );
  const wasLiveSession = session?.type === CONST.SESSION.TYPES.LIVE;
  // Figure out last drink added
  const lastDrinkEditTimestamp = getLastDrinkAddedTime(session);
  const lastDrinkAdded = lastDrinkEditTimestamp
    ? DateUtils.getLocalizedTime(lastDrinkEditTimestamp, session?.timezone)
    : 'Unknown';

  const onBackPress = () => {
    const lastScreenName = Navigation.getLastScreenName(true);
    if (lastScreenName === SCREENS.DAY_OVERVIEW.ROOT) {
      Navigation.goBack();
    } else {
      Navigation.navigate(ROUTES.HOME);
    }
  };

  const onEditSessionPress = () => {
    (async () => {
      await DS.navigateToEditSessionScreen(sessionId, session); // Use keyextractor to load id
    })();
  };

  const sessionColor = session.blackout
    ? 'black'
    : convertUnitsToColors(totalUnits, preferences?.units_to_colors);

  const generalMenuItemsData: Menu = useMemo(() => {
    return {
      sectionTranslationKey: 'sessionSummaryScreen.generalSection.title',
      items: [
        {
          titleKey: 'sessionSummaryScreen.generalSection.sessionColor',
          rightComponent: (
            <View
              style={[styles.sessionColorMarker(sessionColor), styles.border]}
            />
          ),
        },
        {
          titleKey: 'sessionSummaryScreen.generalSection.units',
          description: totalUnits.toString(),
        },
        {
          titleKey: 'sessionSummaryScreen.generalSection.date',
          description: sessionDay,
        },
        {
          titleKey: 'sessionSummaryScreen.generalSection.startTime',
          description: sessionStartTime,
          shouldHide: !wasLiveSession,
        },
        {
          titleKey: 'sessionSummaryScreen.generalSection.lastDrinkAdded',
          description: lastDrinkAdded,
          shouldHide: !wasLiveSession,
        },
        {
          titleKey: 'sessionSummaryScreen.generalSection.endTime',
          description: sessionEndTime,
          shouldHide: !wasLiveSession,
        },
        {
          titleKey: 'common.blackout',
          description: translate(session.blackout ? 'common.yes' : 'common.no'),
          shouldHide: !session.blackout,
        },
        {
          titleKey: 'common.note',
          description: session.note,
          shouldHide: !session.note,
        },
      ],
    };
  }, [
    translate,
    session,
    lastDrinkAdded,
    sessionColor,
    sessionDay,
    sessionEndTime,
    sessionStartTime,
    totalUnits,
    wasLiveSession,
    styles,
  ]);

  const drinkMenuItemsData: Menu = useMemo(() => {
    const drinkSums = {
      small_beer: sumDrinksOfSingleType(session.drinks, 'small_beer'),
      beer: sumDrinksOfSingleType(session.drinks, 'beer'),
      wine: sumDrinksOfSingleType(session.drinks, 'wine'),
      weak_shot: sumDrinksOfSingleType(session.drinks, 'weak_shot'),
      strong_shot: sumDrinksOfSingleType(session.drinks, 'strong_shot'),
      cocktail: sumDrinksOfSingleType(session.drinks, 'cocktail'),
      other: sumDrinksOfSingleType(session.drinks, 'other'),
    };
    const drinkData: DrinkMenuItem[] = [
      // {key: 'common.total', val: totalDrinks},
      {key: 'drinks.smallBeer', val: drinkSums.small_beer},
      {key: 'drinks.beer', val: drinkSums.beer},
      {key: 'drinks.wine', val: drinkSums.wine},
      {key: 'drinks.weakShot', val: drinkSums.weak_shot},
      {key: 'drinks.strongShot', val: drinkSums.strong_shot},
      {key: 'drinks.cocktail', val: drinkSums.cocktail},
      {key: 'drinks.other', val: drinkSums.other},
    ];

    return {
      sectionTranslationKey: 'sessionSummaryScreen.drinksSection.title',
      items: _.cloneDeep(drinkData)
        .filter(({val}) => val > 0) // Filter out drinks with 0 count
        .map(({key, val}: DrinkMenuItem) => ({
          titleKey: key,
          description: val.toString(),
        })),
    };
  }, [session.drinks]);

  const otherMenuItemsData: Menu = useMemo(() => {
    return {
      sectionTranslationKey: 'sessionSummaryScreen.otherSection.title',
      items: [
        {
          titleKey: 'common.timezone',
          description: session.timezone ?? '',
        },
        {
          titleKey: 'sessionSummaryScreen.generalSection.type',
          description: translate(
            wasLiveSession
              ? 'drinkingSession.type.live'
              : 'drinkingSession.type.edit',
          ),
        },
      ],
    };
  }, [session, translate, wasLiveSession]);

  const getSessionSummarySection = useCallback(
    (menuItemsData: Menu) => {
      return (
        <Section
          title={translate(menuItemsData.sectionTranslationKey)}
          titleStyles={styles.sectionTitleSimple}
          containerStyles={styles.pb0}
          childrenStyles={styles.pt3}>
          <View>
            {menuItemsData.items.map(
              (detail, index) =>
                !detail?.shouldHide && (
                  <MenuItem
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${detail.titleKey}_${index}`}
                    title={detail.titleKey && translate(detail.titleKey)}
                    titleStyle={styles.plainSectionTitle}
                    description={detail.description}
                    descriptionTextStyle={[
                      styles.textNormalThemeText,
                      styles.mw75,
                      styles.textAlignRight,
                    ]}
                    numberOfLinesDescription={5}
                    wrapperStyle={styles.sectionMenuItemTopDescription}
                    style={[
                      styles.pt0,
                      index !== menuItemsData.items.length - 1 && styles.pb0,
                      // Enable the following to add borders in between items
                      // styles.borderBottomRounded,
                      // {borderBottomLeftRadius: 35, borderBottomRightRadius: 35},
                    ]}
                    disabled
                    shouldGreyOutWhenDisabled={false}
                    shouldUseRowFlexDirection
                    shouldShowRightComponent={!!detail.rightComponent}
                    rightComponent={detail.rightComponent}
                  />
                ),
            )}
          </View>
        </Section>
      );
    },
    [
      styles.pb0,
      styles.plainSectionTitle,
      styles.pt0,
      styles.pt3,
      styles.sectionMenuItemTopDescription,
      styles.sectionTitleSimple,
      styles.textNormalThemeText,
      translate,
    ],
  );

  const generalMenuItems = useMemo(
    () => getSessionSummarySection(generalMenuItemsData),
    [generalMenuItemsData, getSessionSummarySection],
  );
  const drinkMenuItems = useMemo(
    () => getSessionSummarySection(drinkMenuItemsData),
    [drinkMenuItemsData, getSessionSummarySection],
  );
  const otherMenuItems = useMemo(
    () => getSessionSummarySection(otherMenuItemsData),
    [otherMenuItemsData, getSessionSummarySection],
  );

  useEffect(() => {
    const newSession = DSUtils.extractSessionOrEmpty(
      sessionId,
      drinkingSessionData,
    );
    setSession(newSession);
  }, [sessionId, drinkingSessionData]);

  return (
    <ScreenWrapper testID={SessionSummaryScreen.displayName}>
      <HeaderWithBackButton
        onBackButtonPress={onBackPress}
        customRightButton={
          !session.ongoing && (
            <Button
              style={styles.bgTransparent}
              icon={KirokuIcons.Edit}
              onPress={onEditSessionPress}
            />
          )
        }
      />
      <ScrollView>
        <View style={[styles.pb4, styles.alignItemsCenter]}>
          <Text style={styles.textHeadlineH2}>
            {translate('sessionSummaryScreen.title')}
          </Text>
        </View>
        <MenuItemGroup>
          {generalMenuItems}
          {drinkMenuItems}
          {otherMenuItems}
        </MenuItemGroup>
      </ScrollView>
      <View style={[styles.bottomTabBarContainer, styles.ph5]}>
        <Button
          large
          text={translate('common.confirm')}
          onPress={onBackPress}
          style={styles.bottomTabButton}
          success
        />
      </View>
    </ScreenWrapper>
  );
}

SessionSummaryScreen.displayName = 'Session Summary Screen';
export default SessionSummaryScreen;
