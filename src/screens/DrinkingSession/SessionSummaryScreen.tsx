import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import {
  getLastDrinkAddedTime,
  convertUnitsToColors,
  findDrinkNameTranslationKey,
} from '@libs/DataHandling';
import DrinkData from '@libs/DrinkData';
import {rankDrinkKeys} from '@libs/DrinkRanking';
import formatSessionDuration from '@libs/formatSessionDuration';
import {getSessionEntries, sumEntryCounts} from '@libs/SessionEntries';
import Icon from '@components/Icon';
import {resolvePalette} from '@libs/SessionColorPalettes';
import useLocalize from '@hooks/useLocalize';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import type {DrinkingSession, DrinkKey} from '@src/types/onyx';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import useCurrentUserDrinkingSessions from '@hooks/useCurrentUserDrinkingSessions';
import useDrinkProfile from '@hooks/useDrinkProfile';
import type {StackScreenProps} from '@react-navigation/stack';
import CONST from '@src/CONST';
import type SCREENS from '@src/SCREENS';
import Text from '@components/Text';
import type {DrinkingSessionNavigatorParamList} from '@libs/Navigation/types';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import {useEffect, useMemo, useState} from 'react';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import {getSessionDisplayName} from '@libs/SessionName';
import {
  isSessionPrivate,
  visibilityFromIsPrivate,
} from '@libs/SessionVisibility';
import * as DS from '@userActions/DrinkingSession';
import * as TipJarPromptActions from '@userActions/TipJarPrompt';
import DateUtils from '@libs/DateUtils';
import Navigation from '@libs/Navigation/Navigation';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import BottomActionBar from '@components/BottomActionBar';
import Button from '@components/Button';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useStyleUtils from '@hooks/useStyleUtils';
import variables from '@styles/variables';
import ScrollView from '@components/ScrollView';
import MenuItem from '@components/MenuItem';
import Section from '@components/Section';
import SessionPhotoGallery from '@components/SessionPhotoGallery';
import type {TranslationPaths} from '@src/languages/types';
import MenuItemGroup from '@components/MenuItemGroup';
import Switch from '@components/Switch';

type MenuData = {
  titleKey?: TranslationPaths;
  description?: string;
  shouldHide?: boolean;
  rightComponent?: React.ReactNode;
  additionalStyles?: StyleProp<ViewStyle>;

  /** Where tapping the row goes. A row without one is read-only. */
  routeName?: Route;
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
  const preferences = useCurrentUserPreferences();
  const drinkingSessionData = useCurrentUserDrinkingSessions();
  /** The user's own drink order, the one the live card's quick-add row uses. */
  const drinkProfile = useDrinkProfile();
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const theme = useTheme();
  const StyleUtils = useStyleUtils();
  const [session, setSession] = useState<DrinkingSession>(
    DSUtils.extractSessionOrEmpty(sessionId, drinkingSessionData),
  );
  // Drinks info
  const totalUnits = DSUtils.calculateTotalUnits(
    session,
    preferences?.drinks_to_units,
    true,
  );
  // Time info
  const sessionDay = DateUtils.getLocalizedDay(
    session.start_time,
    session?.timezone,
    CONST.DATE.MONTH_DAY_YEAR_ABBR_FORMAT,
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
  const sessionName = getSessionDisplayName(session);
  // Figure out last drink added
  const lastDrinkEditTimestamp = getLastDrinkAddedTime(session);
  const lastDrinkAdded = lastDrinkEditTimestamp
    ? DateUtils.getLocalizedTime(lastDrinkEditTimestamp, session?.timezone)
    : 'Unknown';

  // Closing a summary is the calm moment Home may use for its one tip-jar ask;
  // whether it actually shows is decided there. Arming on unmount rather than in
  // the back handler covers every way out of this screen: the Confirm button,
  // the header arrow, Android back, the iOS swipe and browser back.
  useEffect(() => () => TipJarPromptActions.armMoment(), []);

  const onBackPress = () => {
    // The summary is the flow's leaf: every route into it opens the
    // DrinkingSession modal over its origin (Home, or the day overview), and
    // ending a live session replaces the live screen rather than stacking on
    // it. So leaving is always "close the modal" and the origin is already
    // underneath -- dismissModal instead of navigate(HOME), which would animate
    // twice.
    Navigation.dismissModal();
  };

  const onEditSessionPress = () => {
    (async () => {
      await DS.navigateToEditSessionScreen(sessionId, session); // Use keyextractor to load id
    })();
  };

  const sessionColor = session.blackout
    ? resolvePalette(preferences?.session_color_palette).black
    : convertUnitsToColors(
        totalUnits,
        preferences?.units_to_colors,
        preferences?.session_color_palette,
      );

  /**
   * The details section: everything the hero strip and the breakdown above it
   * do not already say. The name and visibility rows are the edit actions for
   * the two fields this page owns; the rest is read-only context.
   */
  const detailsMenuItemsData: Menu = {
    sectionTranslationKey: 'sessionSummaryScreen.detailsSection.title',
    items: [
      {
        titleKey: 'sessionSummaryScreen.generalSection.name',
        description: sessionName,
        routeName: ROUTES.DRINKING_SESSION_SESSION_NAME_SCREEN.getRoute(
          sessionId,
          ROUTES.DRINKING_SESSION_SUMMARY.getRoute(sessionId),
        ),
        shouldHide: session.ongoing,
      },
      {
        titleKey: 'liveSessionScreen.private',
        rightComponent: (
          <Switch
            accessibilityLabel={translate(
              'liveSessionScreen.privateSwitchLabel',
            )}
            isOn={isSessionPrivate(session)}
            onToggle={value =>
              DS.updateSessionVisibility(
                sessionId,
                session,
                visibilityFromIsPrivate(value),
              )
            }
          />
        ),
        shouldHide: session.ongoing,
      },
      {
        titleKey: 'sessionSummaryScreen.generalSection.sessionColor',
        rightComponent: (
          <View
            style={[
              styles.sessionColorMarker(sessionColor),
              {borderRadius: variables.componentBorderRadiusNormal},
              StyleUtils.getDerivedSwatchBorderStyle(sessionColor),
            ]}
          />
        ),
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

  /**
   * The session's drinks, per type, read through the entries adapter in ONE
   * pass (RFC decision 1). A legacy session's buckets are converted by the
   * adapter, so this reads the same for both schemas and never touches
   * `drinks` directly. Only types the session actually contains are kept, in
   * the user's own order for a session starting at this hour, so the breakdown
   * leads with what they usually drink rather than with a fixed list.
   */
  const drinkBreakdown = useMemo(() => {
    const countsByKey = new Map<DrinkKey, number>();
    for (const entry of getSessionEntries(session)) {
      countsByKey.set(
        entry.key,
        (countsByKey.get(entry.key) ?? 0) + entry.count,
      );
    }
    const rankedKeys = rankDrinkKeys(drinkProfile, session);
    return DrinkData.map(({key, icon}) => ({
      key,
      icon,
      count: countsByKey.get(key) ?? 0,
    }))
      .filter(({count}) => count > 0)
      .sort((a, b) => rankedKeys.indexOf(a.key) - rankedKeys.indexOf(b.key));
  }, [session, drinkProfile]);

  /** Every drink in the session, however it was logged. */
  const totalDrinks = useMemo(
    () => sumEntryCounts(getSessionEntries(session)),
    [session],
  );

  const sessionDuration = formatSessionDuration(
    DSUtils.calculateSessionLength(session) as number,
  );

  useEffect(() => {
    const newSession = DSUtils.extractSessionOrEmpty(
      sessionId,
      drinkingSessionData,
    );
    setSession(newSession);
  }, [sessionId, drinkingSessionData]);

  return (
    <ScreenWrapper
      shouldShowOfflineIndicator={false}
      testID={SessionSummaryScreen.displayName}>
      <HeaderWithBackButton
        onBackButtonPress={onBackPress}
        customRightButton={
          !session.ongoing && (
            <Button
              style={styles.bgTransparent}
              icon={KirokuIcons.Edit}
              onPress={onEditSessionPress}
              testID="summary-edit-session"
            />
          )
        }
      />
      <ScrollView>
        {/* Header: what the session was and when. */}
        <View style={[styles.pb4, styles.alignItemsCenter, styles.ph5]}>
          <Text
            style={styles.textHeadlineH2}
            numberOfLines={2}
            testID="session-detail-name">
            {sessionName}
          </Text>
          <Text style={[styles.textSupporting, styles.mt1]}>
            {wasLiveSession
              ? `${sessionDay} · ${sessionStartTime}`
              : sessionDay}
          </Text>
        </View>
        {/* The three numbers that describe the session, read at a glance. */}
        <View
          style={[
            styles.flexRow,
            styles.justifyContentBetween,
            styles.ph5,
            styles.pb4,
          ]}>
          {[
            {
              key: 'duration',
              label: translate('sessionSummaryScreen.statsSection.duration'),
              value: sessionDuration,
              shouldHide: !wasLiveSession,
            },
            {
              key: 'units',
              label: translate('sessionSummaryScreen.generalSection.units'),
              value: totalUnits.toString(),
            },
            {
              key: 'drinks',
              label: translate('sessionSummaryScreen.statsSection.drinks'),
              value: totalDrinks.toString(),
            },
          ]
            .filter(stat => !stat.shouldHide)
            .map(stat => (
              <View
                key={stat.key}
                style={[styles.flex1, styles.alignItemsCenter]}>
                <Text
                  style={styles.textHeadlineH2}
                  testID={`session-stat-${stat.key}`}>
                  {stat.value}
                </Text>
                <Text style={[styles.textLabelSupporting, styles.mt1]}>
                  {stat.label}
                </Text>
              </View>
            ))}
        </View>
        {/* Below the hero the page reads as a stack of cards, the way the
            rest of the app groups content: one card per thing the session
            has, so a long session doesn't scroll as one undivided run. */}
        <MenuItemGroup>
          {/* The photos read from the session record itself, so they arrive
              with the rest of it and the calendar sees the same map. */}
          <Section
            title={translate('sessionPhotos.title')}
            titleStyles={styles.sectionTitleSimple}
            childrenStyles={styles.pt3}>
            <SessionPhotoGallery
              sessionId={sessionId}
              photos={session.photos}
            />
          </Section>
          {/* What was drunk, per type, straight off the entries. One row per
              type: the counts line up in a column, so they can be compared,
              and seven types still read as a list rather than a ragged wrap. */}
          {drinkBreakdown.length > 0 ? (
            <Section
              title={translate('sessionSummaryScreen.drinksSection.title')}
              titleStyles={styles.sectionTitleSimple}
              childrenStyles={styles.pt3}>
              <View>
                {drinkBreakdown.map(({key, icon, count}, index) => (
                  <View
                    key={key}
                    style={[
                      styles.flexRow,
                      styles.alignItemsCenter,
                      index > 0 && styles.mt3,
                    ]}
                    testID={`session-drink-${key}`}>
                    <Icon
                      src={icon}
                      fill={theme.textSupporting}
                      width={variables.iconSizeNormal}
                      height={variables.iconSizeNormal}
                    />
                    <Text
                      style={[styles.textNormal, styles.ml3, styles.flex1]}
                      numberOfLines={1}>
                      {translate(findDrinkNameTranslationKey(key))}
                    </Text>
                    <Text style={[styles.textNormal, styles.textStrong]}>
                      {count}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}
          {/* The note reads as prose, not as a truncated menu row. */}
          {session.note ? (
            <Section
              title={translate('common.note')}
              titleStyles={styles.sectionTitleSimple}
              childrenStyles={styles.pt3}>
              <Text style={styles.textNormal}>{session.note}</Text>
            </Section>
          ) : null}
          <Section
            title={translate(detailsMenuItemsData.sectionTranslationKey)}
            titleStyles={styles.sectionTitleSimple}
            containerStyles={styles.pb0}
            childrenStyles={styles.pt3}>
            <View>
              {detailsMenuItemsData.items.map((detail, index) =>
                detail?.shouldHide ? null : (
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
                      index !== detailsMenuItemsData.items.length - 1 &&
                        styles.pb0,
                    ]}
                    disabled={!detail.routeName}
                    shouldGreyOutWhenDisabled={false}
                    shouldUseRowFlexDirection
                    shouldShowRightIcon={!!detail.routeName}
                    onPress={
                      detail.routeName
                        ? () => Navigation.navigate(detail.routeName)
                        : undefined
                    }
                    shouldShowRightComponent={!!detail.rightComponent}
                    rightComponent={detail.rightComponent}
                  />
                ),
              )}
            </View>
          </Section>
        </MenuItemGroup>
      </ScrollView>
      <BottomActionBar>
        <Button
          large
          text={translate('common.confirm')}
          onPress={onBackPress}
          style={styles.bottomTabButton}
          success
        />
      </BottomActionBar>
    </ScreenWrapper>
  );
}

SessionSummaryScreen.displayName = 'Session Summary Screen';
export default SessionSummaryScreen;
