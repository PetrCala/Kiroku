import React, {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {endOfToday} from 'date-fns';
import UserOffline from '@components/UserOfflineModal';
import {useUserConnection} from '@context/global/UserConnectionContext';
import type {StackScreenProps} from '@react-navigation/stack';
import type {Database} from 'firebase/database';
import type {User} from 'firebase/auth';
import type {DayOverviewNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import Navigation from '@libs/Navigation/Navigation';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import useCurrentUserDrinkingSessions from '@hooks/useCurrentUserDrinkingSessions';
import {useFirebase} from '@context/global/FirebaseContext';
import useFetchData from '@hooks/useFetchData';
import useDrinkingSessionsFetch from '@hooks/useDrinkingSessionsFetch';
import type {FetchDataKeys} from '@hooks/useFetchData/types';
import {dateStringToDate, dateToDateData} from '@libs/DataHandling';
import * as App from '@userActions/App';
import * as DS from '@userActions/DrinkingSession';
import * as ErrorUtils from '@libs/ErrorUtils';
import ERRORS from '@src/ERRORS';
import CONST from '@src/CONST';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import SessionsCalendar from '@components/SessionsCalendar';
import DateSelectorModal from '@components/DateSelectorModal';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {PressableWithFeedback} from '@components/Pressable';
import useLocalize from '@hooks/useLocalize';
import useReadyAfterScreenTransition from '@hooks/useReadyAfterScreenTransition';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import DayOverviewSkeleton from './DayOverviewSkeleton';

type DayOverviewScreenProps = StackScreenProps<
  DayOverviewNavigatorParamList,
  typeof SCREENS.DAY_OVERVIEW.ROOT
>;

const internalStyles = StyleSheet.create({
  // Mounted-but-invisible until the list applies its initial scroll, so the
  // user never sees a jump to the focused day.
  hidden: {opacity: 0},
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
  },
  // Round brand button in the header — the Edit/Done toggle. Background color
  // is applied inline since it comes from the (per-render) theme.
  editToggle: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function noop() {}

// Non-windowed keys to fetch for a friend (their session data is fetched
// separately via `useDrinkingSessionsFetch`). Mirrors `SessionsCalendarScreen`.
const FRIEND_FETCH_KEYS: FetchDataKeys = ['preferences'];

// Module-level so React Compiler skips it — the `try/finally` it needs bails
// the compiler, and that would regress the screen's compilation.
async function createSessionForDay(
  db: Database,
  user: User | null,
  date: Date,
  timezone: SelectedTimezone | undefined,
  loadingText: string,
) {
  try {
    await App.setLoadingText(loadingText);
    const newSession = await DS.getNewSessionToEdit(db, user, date, timezone);
    await DS.navigateToEditSessionScreen(newSession?.id);
  } catch (error) {
    ErrorUtils.raiseAppError(ERRORS.DATABASE.USER_CREATION_FAILED, error);
  } finally {
    await App.setLoadingText(null);
  }
}

function DayOverviewScreen({route}: DayOverviewScreenProps) {
  const {userID, date} = route.params;
  const {isOnline} = useUserConnection();
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const theme = useTheme();
  const {auth, db} = useFirebase();
  const user = auth.currentUser;
  const isSelf = user?.uid === userID;
  const [loadingText] = useOnyx(ONYXKEYS.APP_LOADING_TEXT);

  // Self reads the current user's sessions from the dedicated hook; a friend's
  // data is fetched on demand (same self/other gating as
  // `SessionsCalendarScreen`). The non-needed hook is invoked with an empty
  // `userID`, which both hooks treat as a no-op.
  const ownData = useDatabaseData();
  const currentUserSessions = useCurrentUserDrinkingSessions();
  const {data: friendFetchedData, isLoading: isFriendFetchLoading} =
    useFetchData(isSelf ? '' : userID, FRIEND_FETCH_KEYS);
  const {
    data: friendSessionData,
    isLoading: isFriendSessionsLoading,
    isFetchingOlderMonths: friendFetchingOlder,
  } = useDrinkingSessionsFetch(isSelf ? '' : userID);

  const drinkingSessionData = isSelf ? currentUserSessions : friendSessionData;
  const preferences = isSelf
    ? ownData.preferences
    : friendFetchedData?.preferences;
  const isFetchingOlderMonths = isSelf
    ? ownData.isFetchingOlderMonths
    : friendFetchingOlder;
  // Timezone is only read by the self-only add-session flow, so the current
  // user's own data is always the right source here.
  const userData = ownData.userData;

  // Hold the list invisible (skeleton on top) until it has scrolled to the
  // focused day. With no `date` (shouldn't happen via the calendar) we never
  // wait.
  const [isScrollReady, setIsScrollReady] = useState<boolean>(!date);
  const onInitialScrollReady = useCallback(() => setIsScrollReady(true), []);

  // Defer mounting the (heavy) session list until after the navigation slide.
  // `useLazyMarkedDates` filters/indexes all sessions synchronously on first
  // render, which otherwise blocks the modal's slide-in ("nothing happens,
  // then the screen appears"). Gate on the screen's transition-end so the
  // slide paints against the skeleton first, then mount the list.
  const {isReady: didScreenTransitionEnd, onEntryTransitionEnd} =
    useReadyAfterScreenTransition();

  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

  // Edit mode reveals a per-session edit affordance on every tile (self only).
  // Toggled from the header; persists across the edit round-trip so the user
  // can edit several sessions in a row.
  const [editMode, setEditMode] = useState(false);

  // The day the user is currently looking at — opens the add-session picker on
  // the viewed month. Seeded with the focused day, updated as the user scrolls.
  const [visibleDay, setVisibleDay] = useState<DateString | undefined>(date);

  // dayList mode ignores `visibleDate`/`onDateChange`, but the shared
  // `SessionsCalendar` props require them.
  const placeholderVisibleDate = useMemo(() => dateToDateData(new Date()), []);

  const selectedTimezone = userData?.timezone?.selected;
  const onPickDate = useCallback(
    (selectedDate: Date) => {
      setIsDatePickerVisible(false);
      // createSessionForDay handles its own errors; the .catch is a no-op to
      // satisfy no-floating-promises.
      createSessionForDay(
        db,
        auth.currentUser,
        selectedDate,
        selectedTimezone,
        translate('liveSessionScreen.loading'),
      ).catch(() => {});
    },
    [db, auth, selectedTimezone, translate],
  );

  if (!isOnline) {
    return <UserOffline />;
  }
  if (!date || !!loadingText) {
    return <FullScreenLoadingIndicator loadingText={loadingText} />;
  }

  const isFriendLoading =
    !isSelf && (isFriendFetchLoading || isFriendSessionsLoading);
  const isReady =
    !!user &&
    !!preferences &&
    drinkingSessionData !== undefined &&
    !isFriendLoading;
  const showSkeleton = !didScreenTransitionEnd || !isReady || !isScrollReady;

  return (
    <ScreenWrapper
      testID={DayOverviewScreen.displayName}
      onEntryTransitionEnd={onEntryTransitionEnd}>
      <HeaderWithBackButton
        title={translate('calendar.fullscreenTitle')}
        onBackButtonPress={Navigation.goBack}
        shouldAlignTitleStart
        customRightButton={
          isSelf ? (
            <PressableWithFeedback
              accessibilityLabel={translate(
                editMode ? 'common.done' : 'common.edit',
              )}
              accessibilityRole={CONST.ROLE.BUTTON}
              onPress={() => setEditMode(prev => !prev)}
              style={[
                internalStyles.editToggle,
                {
                  backgroundColor: editMode
                    ? theme.successPressed
                    : theme.appColor,
                },
              ]}>
              <Icon
                src={editMode ? KirokuIcons.Checkmark : KirokuIcons.Edit}
                fill={theme.textOnBrand}
                width={18}
                height={18}
              />
            </PressableWithFeedback>
          ) : undefined
        }
      />
      <View style={styles.flex1}>
        {isReady && didScreenTransitionEnd && (
          <View
            style={[
              styles.flex1,
              styles.ph2,
              !isScrollReady && internalStyles.hidden,
            ]}>
            <SessionsCalendar
              userID={userID}
              visibleDate={placeholderVisibleDate}
              onDateChange={noop}
              drinkingSessionData={drinkingSessionData}
              preferences={preferences}
              isFetchingOlderMonths={isFetchingOlderMonths}
              mode="dayList"
              initialDay={date}
              onInitialScrollReady={onInitialScrollReady}
              onVisibleDayChange={setVisibleDay}
              isReadOnly={!isSelf}
              isEditModeOn={editMode}
            />
          </View>
        )}
        {showSkeleton && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <DayOverviewSkeleton />
          </View>
        )}
        {!showSkeleton && isSelf && (
          <PressableWithFeedback
            accessibilityLabel={translate(
              'dayOverviewScreen.addSessionExplained',
            )}
            accessibilityRole={CONST.ROLE.BUTTON}
            onPress={() => setIsDatePickerVisible(true)}
            style={[styles.floatingActionButton, internalStyles.fab]}>
            <Icon
              src={KirokuIcons.Plus}
              fill={theme.textLight}
              width={variables.iconSizeNormal}
              height={variables.iconSizeNormal}
            />
          </PressableWithFeedback>
        )}
      </View>
      {isSelf && (
        <DateSelectorModal
          mode="single"
          isVisible={isDatePickerVisible}
          title={translate('dayOverviewScreen.selectSessionDate')}
          initialDate={visibleDay ? dateStringToDate(visibleDay) : new Date()}
          maxDate={endOfToday()}
          applyText={translate('common.confirm')}
          cancelText={translate('common.cancel')}
          onApply={onPickDate}
          onCancel={() => setIsDatePickerVisible(false)}
        />
      )}
    </ScreenWrapper>
  );
}

DayOverviewScreen.displayName = 'Day Overview Screen';
export default DayOverviewScreen;
