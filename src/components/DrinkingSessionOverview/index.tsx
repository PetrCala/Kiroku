import React from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import Icon from '@components/Icon';
import {convertUnitsToColors, sumSessionDrinksOfType} from '@libs/DataHandling';
import DrinkData from '@libs/DrinkData';
import {rankDrinkKeys} from '@libs/DrinkRanking';
import {resolvePalette} from '@libs/SessionColorPalettes';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import * as DS from '@userActions/DrinkingSession';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import {getSessionDisplayName} from '@libs/SessionName';
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
  enableLongPressToEdit = false,
  preferences: preferencesProp,
  drinkProfile,
}: DrinkingSessionOverviewProps) {
  const ownPreferences = useCurrentUserPreferences();
  const preferences = preferencesProp ?? ownPreferences;
  const {translate} = useLocalize();
  const theme = useTheme();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const [ongoingSession] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);
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
      const liveSessionId = ongoingSession?.ongoing
        ? ongoingSession.id
        : undefined;
      if (liveSessionId && liveSessionId !== sessionId) {
        // Another session is live on this device, so this one is a session the
        // server still flags ongoing that nobody is logging into (orphaned by
        // an earlier bug, or started elsewhere). Open it in the edit flow,
        // whose save closes it, instead of swapping it into the live buffer
        // over the session the user is actually in.
        await DS.navigateToEditSessionScreen(sessionId, {
          ...session,
          ongoing: false,
        });
        return;
      }
      if (!liveSessionId) {
        await DS.updateLocalData(
          ONYXKEYS.ONGOING_SESSION_DATA,
          session,
          sessionId,
        );
      }
      // The live buffer already holds this session: it is at least as fresh
      // as the snapshot copy, so navigate without overwriting it.
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
    session,
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
  // so the tile surfaces what the session actually contained at a glance. The
  // types run in the viewer's own order for a session starting at this hour,
  // the same order the live card's quick-add row and the detail page use.
  const rankedKeys = rankDrinkKeys(drinkProfile, session);
  const drinkBreakdown = DrinkData.map(({key, icon}) => ({
    key,
    icon,
    count: sumSessionDrinksOfType(session, key),
  }))
    .filter(({count}) => count > 0)
    .sort((a, b) => rankedKeys.indexOf(a.key) - rankedKeys.indexOf(b.key));

  const sessionDetails = (
    <View
      style={[
        styles.flexRow,
        styles.alignItemsCenter,
        styles.justifyContentBetween,
        styles.flex1,
      ]}>
      {/* Left: name, units + (live) time */}
      <View style={[styles.flexColumn, styles.flexShrink1]}>
        <Text style={[styles.textNormal, styles.textStrong]} numberOfLines={1}>
          {getSessionDisplayName(session)}
        </Text>
        <Text style={[styles.textMicroSupporting, styles.mt1]}>
          {translate('common.units')}: {totalUnits}
          {shouldDisplayTime ? ` · ${timeString}` : ''}
        </Text>
      </View>
      {/* Right: per-drink-type breakdown as compact icon-over-count columns */}
      {drinkBreakdown.length > 0 && (
        <View
          style={[styles.flexRow, styles.alignItemsCenter, styles.flexWrap]}>
          {drinkBreakdown.map(({key, icon, count}) => (
            <View key={key} style={[styles.alignItemsCenter, styles.ml3]}>
              <Icon
                src={icon}
                fill={theme.textSupporting}
                width={18}
                height={18}
              />
              <Text style={[styles.textMicroSupporting, styles.mt1]}>
                {count}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (readOnly) {
    return <View style={rowStyle}>{sessionDetails}</View>;
  }

  // Long-press jumps straight to edit, skipping the Edit/Done toggle. Withheld
  // for ongoing sessions, which surface the live-session button instead of an
  // edit affordance. The heavy-impact haptic fires from GenericPressable.
  const onLongPress =
    enableLongPressToEdit && !session?.ongoing
      ? onNavigateToEditSession
      : undefined;

  return (
    <PressableWithFeedback
      accessibilityLabel={translate('dayOverviewScreen.sessionWindow', {
        sessionId,
      })}
      accessibilityRole={CONST.ROLE.BUTTON}
      style={rowStyle}
      onPress={() => onSessionButtonPress()}
      onLongPress={onLongPress}>
      {sessionDetails}
      {session?.ongoing ? (
        <Button
          danger
          style={styles.ml2}
          onPress={() => onSessionButtonPress()}
          text={translate('dayOverviewScreen.ongoing')}
        />
      ) : (
        isEditModeOn && (
          <PressableWithFeedback
            accessibilityLabel={translate('common.edit')}
            accessibilityRole={CONST.ROLE.BUTTON}
            onPress={onNavigateToEditSession}
            style={styles.p2}>
            <Icon src={KirokuIcons.Edit} fill={theme.icon} />
          </PressableWithFeedback>
        )
      )}
    </PressableWithFeedback>
  );
}

export default DrinkingSessionOverview;
