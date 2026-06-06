import React, {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {endOfDay} from 'date-fns';
import {toZonedTime} from 'date-fns-tz';
import UserOffline from '@components/UserOfflineModal';
import {useUserConnection} from '@context/global/UserConnectionContext';
import type {StackScreenProps} from '@react-navigation/stack';
import type {DayOverviewNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import Navigation from '@libs/Navigation/Navigation';
import useStartEditSessionForDate from '@hooks/useStartEditSessionForDate';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useCurrentUserDrinkingSessions from '@hooks/useCurrentUserDrinkingSessions';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import {useFirebase} from '@context/global/FirebaseContext';
import useFriendPreferences from '@hooks/useFriendPreferences';
import useDrinkingSessionsFetch from '@hooks/useDrinkingSessionsFetch';
import {dateStringToDate, dateToDateData} from '@libs/DataHandling';
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

function DayOverviewScreen({route}: DayOverviewScreenProps) {
  const {userID, date} = route.params;
  const {isOnline} = useUserConnection();
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const theme = useTheme();
  const {auth} = useFirebase();
  const user = auth.currentUser;
  const isSelf = user?.uid === userID;
  const startEditSessionForDate = useStartEditSessionForDate();
  const [loadingText] = useOnyx(ONYXKEYS.APP_LOADING_TEXT);
  const userData = useCurrentUserData();
  // The add-session date picker spans the user's calendar days in their selected
  // timezone, so the "today" cap matches the day they actually live in rather
  // than the device's local day.
  const timezone =
    userData?.timezone?.selected ?? CONST.DEFAULT_TIME_ZONE.selected;
  // `toZonedTime` goes through Intl (slow on Hermes) and this screen re-renders
  // on calendar scroll, so snapshot "today" in the user's tz once per tz change
  // rather than recomputing it every frame.
  const todayInTz = useMemo(
    () => toZonedTime(new Date(), timezone),
    [timezone],
  );
  const maxDate = useMemo(() => endOfDay(todayInTz), [todayInTz]);

  // Self reads the current user's sessions from the dedicated hook; a friend's
  // data is fetched on demand (same self/other gating as
  // `SessionsCalendarScreen`). The non-needed hook is invoked with an empty
  // `userID`, which both hooks treat as a no-op.
  const ownPreferences = useCurrentUserPreferences();
  const currentUserSessions = useCurrentUserDrinkingSessions();
  const {preferences: friendPreferences, isLoading: isFriendFetchLoading} =
    useFriendPreferences(isSelf ? '' : userID);
  const {
    data: friendSessionData,
    isLoading: isFriendSessionsLoading,
    isFetchingOlderMonths: friendFetchingOlder,
  } = useDrinkingSessionsFetch(isSelf ? '' : userID);

  const drinkingSessionData = isSelf ? currentUserSessions : friendSessionData;
  const preferences = isSelf ? ownPreferences : friendPreferences;
  const isFetchingOlderMonths = isSelf ? false : friendFetchingOlder;
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
  // Also drives the list's restore target (see `initialDay` below): because it
  // lives on this screen (which stays mounted across the edit round-trip), it
  // outlives the list subtree, so the list lands back where the user was.
  const [visibleDay, setVisibleDay] = useState<DateString | undefined>(date);

  // dayList mode ignores `visibleDate`/`onDateChange`, but the shared
  // `SessionsCalendar` props require them.
  const placeholderVisibleDate = useMemo(() => dateToDateData(new Date()), []);

  const onPickDate = useCallback(
    (selectedDate: Date) => {
      setIsDatePickerVisible(false);
      startEditSessionForDate(selectedDate);
    },
    [startEditSessionForDate],
  );

  if (!isOnline) {
    return <UserOffline />;
  }
  // Show the global loading overlay only before the list has first rendered.
  // Once the list is up (`isScrollReady`), a transient loadingText from a child
  // edit/delete flow (the "Saving…"/"Deleting…" set in `DrinkingSessionWindow`)
  // must NOT swap the tree for the full-screen loader: that unmounts and then
  // remounts the heavy session list, which loses its scroll position and forces
  // a visible from-scratch re-render — the synchronous `useLazyMarkedDates`
  // re-index plus a FlashList remount — on return. Keeping the list mounted lets
  // the edited/deleted session update in place via FlashList's normal data diff,
  // with the scroll position preserved exactly. See #1015 / #1024.
  if (!date || (!!loadingText && !isScrollReady)) {
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
              // Restore to where the user last was, not the route's `date`.
              // Saving a session sets a global "Saving…" loading text, which
              // momentarily swaps this screen's tree for the full-screen loader
              // (see the `loadingText` guard above) and so remounts the list.
              // The remounted list re-applies its initial centering — on `date`
              // (often a recent day, i.e. the bottom of the oldest→newest list)
              // that reads as "jumped to the bottom". `visibleDay` tracks the
              // user's scroll position and survives the remount, so centering on
              // it lands them back where they left off. On first mount it equals
              // `date`, preserving the open-on-the-tapped-day behavior.
              initialDay={visibleDay ?? date}
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
          initialDate={visibleDay ? dateStringToDate(visibleDay) : todayInTz}
          maxDate={maxDate}
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
