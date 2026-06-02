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
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import Navigation from '@libs/Navigation/Navigation';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import {dateToDateData} from '@libs/DataHandling';
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
});

function noop() {}

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
  const {date} = route.params;
  const {isOnline} = useUserConnection();
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const {textLight} = useTheme();
  const {auth, db} = useFirebase();
  const user = auth.currentUser;
  const [loadingText] = useOnyx(ONYXKEYS.APP_LOADING_TEXT);
  const {drinkingSessionData, preferences, userData, isFetchingOlderMonths} =
    useDatabaseData();

  // Hold the list invisible (skeleton on top) until it has scrolled to the
  // focused day. With no `date` (shouldn't happen via the calendar) we never
  // wait.
  const [isScrollReady, setIsScrollReady] = useState<boolean>(!date);
  const onInitialScrollReady = useCallback(() => setIsScrollReady(true), []);

  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

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

  const isReady = !!user && !!preferences && drinkingSessionData !== undefined;
  const showSkeleton = !isReady || !isScrollReady;

  return (
    <ScreenWrapper testID={DayOverviewScreen.displayName}>
      <HeaderWithBackButton
        title={translate('calendar.fullscreenTitle')}
        onBackButtonPress={Navigation.goBack}
      />
      <View style={styles.flex1}>
        {isReady && (
          <View
            style={[
              styles.flex1,
              styles.ph2,
              !isScrollReady && internalStyles.hidden,
            ]}>
            <SessionsCalendar
              userID={user.uid}
              visibleDate={placeholderVisibleDate}
              onDateChange={noop}
              drinkingSessionData={drinkingSessionData}
              preferences={preferences}
              isFetchingOlderMonths={isFetchingOlderMonths}
              mode="dayList"
              initialDay={date}
              onInitialScrollReady={onInitialScrollReady}
            />
          </View>
        )}
        {showSkeleton && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <DayOverviewSkeleton />
          </View>
        )}
        {!showSkeleton && (
          <PressableWithFeedback
            accessibilityLabel={translate(
              'dayOverviewScreen.addSessionExplained',
            )}
            accessibilityRole={CONST.ROLE.BUTTON}
            onPress={() => setIsDatePickerVisible(true)}
            style={[styles.floatingActionButton, internalStyles.fab]}>
            <Icon
              src={KirokuIcons.Plus}
              fill={textLight}
              width={variables.iconSizeNormal}
              height={variables.iconSizeNormal}
            />
          </PressableWithFeedback>
        )}
      </View>
      <DateSelectorModal
        mode="single"
        isVisible={isDatePickerVisible}
        title={translate('dayOverviewScreen.selectSessionDate')}
        initialDate={new Date()}
        maxDate={endOfToday()}
        applyText={translate('common.confirm')}
        cancelText={translate('common.cancel')}
        onApply={onPickDate}
        onCancel={() => setIsDatePickerVisible(false)}
      />
    </ScreenWrapper>
  );
}

DayOverviewScreen.displayName = 'Day Overview Screen';
export default DayOverviewScreen;
