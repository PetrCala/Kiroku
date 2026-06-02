import React from 'react';
import {View} from 'react-native';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import Icon from '@components/Icon';
import {convertUnitsToColors, sumDrinksOfSingleType} from '@libs/DataHandling';
import DrinkData from '@libs/DrinkData';
import {resolvePalette} from '@libs/SessionColorPalettes';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import * as DS from '@userActions/DrinkingSession';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import CONST from '@src/CONST';
import {nonMidnightString} from '@libs/StringUtilsKiroku';
import Button from '@components/Button';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useStyleUtils from '@hooks/useStyleUtils';
import Text from '@components/Text';
import DateUtils from '@libs/DateUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import {PressableWithFeedback} from '@components/Pressable';
import type DrinkingSessionOverviewProps from './types';

function DrinkingSessionOverview({
  sessionId,
  session,
  isEditModeOn,
  readOnly = false,
  preferences: preferencesProp,
}: DrinkingSessionOverviewProps) {
  const {preferences: ownPreferences} = useDatabaseData();
  const preferences = preferencesProp ?? ownPreferences;
  const {translate} = useLocalize();
  const theme = useTheme();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  // Convert the timestamp to a Date object
  const timeString = nonMidnightString(
    DateUtils.getLocalizedTime(session.start_time, session.timezone),
  );
  const shouldDisplayTime = session.type === CONST.SESSION.TYPES.LIVE;

  const onSessionButtonPress = () => {
    (async () => {
      if (!session?.ongoing) {
        Navigation.navigate(
          ROUTES.DRINKING_SESSION_SUMMARY.getRoute(sessionId),
        );
        return;
      }
      await DS.updateLocalData(
        ONYXKEYS.ONGOING_SESSION_DATA,
        session,
        sessionId,
      );
      DS.navigateToOngoingSessionScreen();
    })();
  };

  const onNavigateToEditSession = () => {
    (async () => {
      await DS.navigateToEditSessionScreen(sessionId, session);
    })();
  };

  // Calculate the session color
  const totalUnits = DSUtils.calculateTotalUnits(
    session.drinks,
    preferences?.drinks_to_units,
    true,
  );
  let sessionColor = convertUnitsToColors(
    totalUnits,
    preferences?.units_to_colors,
    preferences?.session_color_palette,
  );
  if (session.blackout === true) {
    sessionColor = resolvePalette(preferences?.session_color_palette).black;
  }

  const rowStyle = [
    styles.flexRow,
    styles.alignItemsCenter,
    styles.justifyContentBetween,
    styles.p4,
    styles.mh1,
    styles.mb2,
    StyleUtils.getColorAccentRowStyle(sessionColor),
    {minHeight: 84},
  ];

  // Per-drink-type counts (non-zero only), shown as a compact icon + count row
  // so the tile surfaces what the session actually contained at a glance.
  const drinkBreakdown = DrinkData.map(({key, icon}) => ({
    key,
    icon,
    count: sumDrinksOfSingleType(session.drinks, key),
  })).filter(({count}) => count > 0);

  const sessionDetails = (
    <View style={[styles.flexColumn, styles.flex1]}>
      <Text style={[styles.textNormal, styles.textStrong]}>
        {translate('common.units')}: {totalUnits}
      </Text>
      {drinkBreakdown.length > 0 && (
        <View
          style={[
            styles.flexRow,
            styles.alignItemsCenter,
            styles.flexWrap,
            styles.mt1,
          ]}>
          {drinkBreakdown.map(({key, icon, count}) => (
            <View
              key={key}
              style={[styles.flexRow, styles.alignItemsCenter, styles.mr3]}>
              <Icon
                src={icon}
                fill={theme.textSupporting}
                width={16}
                height={16}
              />
              <Text style={[styles.textMicroSupporting, styles.ml1]}>
                {count}
              </Text>
            </View>
          ))}
        </View>
      )}
      {shouldDisplayTime && (
        <Text style={[styles.textMicroSupporting, styles.mt1]}>
          {translate('common.time')}: {timeString}
        </Text>
      )}
    </View>
  );

  if (readOnly) {
    return <View style={rowStyle}>{sessionDetails}</View>;
  }

  return (
    <PressableWithFeedback
      accessibilityLabel={translate('dayOverviewScreen.sessionWindow', {
        sessionId,
      })}
      style={rowStyle}
      onPress={() => onSessionButtonPress()}>
      {sessionDetails}
      {session?.ongoing ? (
        <Button
          danger
          onPress={() => onSessionButtonPress()}
          text={translate('dayOverviewScreen.ongoing')}
        />
      ) : (
        isEditModeOn && (
          <Button
            large
            style={styles.bgTransparent}
            icon={KirokuIcons.Edit}
            onPress={onNavigateToEditSession}
          />
        )
      )}
    </PressableWithFeedback>
  );
}

export default DrinkingSessionOverview;
