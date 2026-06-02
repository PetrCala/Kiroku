import React, {memo, useCallback, useEffect, useMemo, useRef} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import type {FlashListRef} from '@shopify/flash-list';
import {format, startOfDay} from 'date-fns';
import lodashDebounce from 'lodash/debounce';
import Text from '@components/Text';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {PressableWithFeedback} from '@components/Pressable';
import DrinkingSessionOverview from '@components/DrinkingSessionOverview';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {dateStringToDate} from '@libs/DataHandling';
import {roundToTwoDecimalPlaces} from '@libs/NumberUtils';
import * as App from '@userActions/App';
import CONST from '@src/CONST';
import variables from '@styles/variables';
import type {Preferences} from '@src/types/onyx';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import type DrinkingSessionKeyValue from '@src/types/utils/databaseUtils';

// Trigger an older-window fetch once the user scrolls within this fraction of
// the list's end (FlashList's `onEndReachedThreshold` is end-relative).
const END_REACHED_THRESHOLD = 1.5;

// Debounce the "last viewed day" Onyx write so a fast scroll fires one write at
// rest rather than on every viewability tick.
const LAST_VIEWED_DEBOUNCE_MS = 250;

// Mirrors the week-list view: a stable config so RN doesn't complain about
// changing viewability handlers on the fly.
const VIEWABILITY_CONFIG = {itemVisiblePercentThreshold: 50};

type DayHeaderItem = {
  kind: 'dayHeader';
  key: string;
  dayKey: DateString;
  units: number;
};

type SessionRowItem = {
  kind: 'session';
  key: string;
  dayKey: DateString;
  entry: DrinkingSessionKeyValue;
};

type ListItem = DayHeaderItem | SessionRowItem;

type DayOverviewListViewProps = {
  /** Sessions grouped by day ('YYYY-MM-DD' keys), within the loaded window. */
  sessionEntriesByDay: Map<DateString, DrinkingSessionKeyValue[]>;
  /** Per-day total unit counts, keyed by `DateString`. */
  unitsMap: Map<DateString, number>;
  /** Preferences driving the session tiles' color/unit computation. */
  preferences: Preferences;
  /** Earliest day currently loaded — the floor the older-fetch widens from. */
  loadedFromDate: Date | null;
  /** True while the data fetcher is widening the loaded window; renders a
   *  "Loading older months…" row at the bottom of the list. */
  isFetchingOlderMonths?: boolean;
  /** Called when the user nears the end of the list; receives the loaded floor
   *  so the parent can decide (via `computeLoadTarget`) whether to widen. */
  onRequestOlder?: (earliestVisible: Date) => void;
  /** Day ('YYYY-MM-DD') to land on at first render. Falls back to the nearest
   *  session day at-or-before it when the exact day has no sessions. */
  initialDay?: DateString;
  /** Fires once the initial scroll has been applied (or determined that no
   *  scroll is needed). The parent screen uses this to unhide the list. */
  onInitialScrollReady?: () => void;
  /** Renders a per-day-header `+` to backfill a session onto that day. Omit to
   *  hide the affordance (e.g. read-only contexts). */
  onAddSessionForDay?: (day: DateString) => void;
};

/**
 * Continuous, all-days scroll of the user's drinking sessions.
 *
 * One vertical list: a sticky header per day (date + total units + an optional
 * `+`), followed by that day's session tiles. Newest day first; scrolling down
 * walks back in time and lazily widens the loaded window. The day-overview
 * counterpart to `SessionsCalendarWeekListView`.
 */
function DayOverviewListView({
  sessionEntriesByDay,
  unitsMap,
  preferences,
  loadedFromDate,
  isFetchingOlderMonths,
  onRequestOlder,
  initialDay,
  onInitialScrollReady,
  onAddSessionForDay,
}: DayOverviewListViewProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();

  // Flatten the day→sessions map into a single list: each day emits a header
  // followed by its sessions (chronological within the day). Build the sticky
  // header indices and a 'YYYY-MM-DD' → header-index map in the same pass for
  // the initial-scroll lookup. Days are descending (newest first).
  const {items, stickyHeaderIndices, dayHeaderIndexByDay, sortedDayKeys} =
    useMemo(() => {
      const out: ListItem[] = [];
      const sticky: number[] = [];
      const headerIndex = new Map<DateString, number>();
      const days = Array.from(sessionEntriesByDay.keys()).sort().reverse();

      days.forEach(dayKey => {
        sticky.push(out.length);
        headerIndex.set(dayKey, out.length);
        out.push({
          kind: 'dayHeader',
          key: `header-${dayKey}`,
          dayKey,
          units: unitsMap.get(dayKey) ?? 0,
        });
        const entries = [...(sessionEntriesByDay.get(dayKey) ?? [])].sort(
          (a, b) => (a.session.start_time ?? 0) - (b.session.start_time ?? 0),
        );
        entries.forEach(entry => {
          out.push({
            kind: 'session',
            key: `session-${entry.sessionId}`,
            dayKey,
            entry,
          });
        });
      });

      return {
        items: out,
        stickyHeaderIndices: sticky,
        dayHeaderIndexByDay: headerIndex,
        sortedDayKeys: days,
      };
    }, [sessionEntriesByDay, unitsMap]);

  // Resolve the row to land on. Exact day if it has sessions, else the nearest
  // session day at-or-before it (days are descending, so the first key <=
  // target is the nearest). `undefined` until the loaded window includes a
  // matching day — the apply-scroll effect waits for `items` to widen.
  const targetIndex = useMemo(() => {
    if (!initialDay) {
      return undefined;
    }
    const exact = dayHeaderIndexByDay.get(initialDay);
    if (exact !== undefined) {
      return exact;
    }
    const fallbackDay = sortedDayKeys.find(d => d <= initialDay);
    return fallbackDay ? dayHeaderIndexByDay.get(fallbackDay) : undefined;
  }, [initialDay, dayHeaderIndexByDay, sortedDayKeys]);

  const listRef = useRef<FlashListRef<ListItem>>(null);
  const hasAppliedInitialScrollRef = useRef(false);

  useEffect(() => {
    if (hasAppliedInitialScrollRef.current) {
      return;
    }
    if (!initialDay) {
      hasAppliedInitialScrollRef.current = true;
      onInitialScrollReady?.();
      return;
    }
    if (targetIndex !== undefined) {
      listRef.current?.scrollToIndex({
        index: targetIndex,
        animated: false,
        viewPosition: 0,
      });
      hasAppliedInitialScrollRef.current = true;
      onInitialScrollReady?.();
      return;
    }
    // No matching day yet. If the loaded window already reaches past the target
    // day, there are simply no sessions at-or-before it to scroll to — stop
    // waiting and reveal the list (empty/oldest view). Otherwise wait for the
    // orchestrator to widen the window; this effect re-fires on `items`.
    const windowCoversTarget =
      loadedFromDate !== null &&
      startOfDay(loadedFromDate).getTime() <=
        dateStringToDate(initialDay).getTime();
    if (windowCoversTarget || items.length === 0) {
      hasAppliedInitialScrollRef.current = true;
      onInitialScrollReady?.();
    }
  }, [
    initialDay,
    targetIndex,
    items.length,
    loadedFromDate,
    onInitialScrollReady,
  ]);

  // Record the day the user is looking at so the home/profile calendar can
  // sync to it on back-navigation. Debounced; the writer reads the top-most
  // visible item on each viewability change.
  const writeLastViewedDay = useMemo(
    () =>
      lodashDebounce((day: DateString) => {
        App.setLastViewedCalendarDate(day);
      }, LAST_VIEWED_DEBOUNCE_MS),
    [],
  );
  useEffect(() => () => writeLastViewedDay.cancel(), [writeLastViewedDay]);

  const onViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: Array<{index: number | null}>}) => {
      let minIndex = Number.POSITIVE_INFINITY;
      viewableItems.forEach(item => {
        if (item.index !== null && item.index < minIndex) {
          minIndex = item.index;
        }
      });
      if (minIndex === Number.POSITIVE_INFINITY) {
        return;
      }
      const topItem = items[minIndex];
      if (topItem) {
        writeLastViewedDay(topItem.dayKey);
      }
    },
    [items, writeLastViewedDay],
  );

  const onEndReached = useCallback(() => {
    if (!onRequestOlder || items.length === 0) {
      return;
    }
    // Widen relative to the loaded floor — `computeLoadTarget` only extends
    // when the surfaced date is near the floor, so passing the floor itself
    // reliably advances the window by the parent's buffer each time.
    onRequestOlder(loadedFromDate ?? new Date());
  }, [onRequestOlder, items.length, loadedFromDate]);

  const renderItem = useCallback(
    (args: {item: ListItem}) => {
      const {item} = args;
      if (item.kind === 'dayHeader') {
        const label = format(
          dateStringToDate(item.dayKey),
          CONST.DATE.MONTH_DAY_YEAR_ABBR_FORMAT,
        );
        return (
          <View style={styles.sessionsCalendarMonthLabel}>
            <Text style={styles.sessionsCalendarMonthLabelText}>{label}</Text>
            <View style={styles.sessionsCalendarMonthLabelRule} />
            {item.units > 0 && (
              <Text style={styles.sessionsCalendarMonthLabelTotal}>
                {translate('calendar.dayTotalUnits', {
                  unitCount: roundToTwoDecimalPlaces(item.units),
                })}
              </Text>
            )}
            {onAddSessionForDay && (
              <PressableWithFeedback
                accessibilityLabel={translate(
                  'dayOverviewScreen.addSessionExplained',
                )}
                accessibilityRole={CONST.ROLE.BUTTON}
                onPress={() => onAddSessionForDay(item.dayKey)}
                style={styles.ml2}>
                <Icon
                  src={KirokuIcons.Plus}
                  fill={theme.textSupporting}
                  width={variables.iconSizeSmall}
                  height={variables.iconSizeSmall}
                />
              </PressableWithFeedback>
            )}
          </View>
        );
      }
      return (
        <DrinkingSessionOverview
          sessionId={item.entry.sessionId}
          session={item.entry.session}
          isEditModeOn={false}
          preferences={preferences}
        />
      );
    },
    [
      preferences,
      onAddSessionForDay,
      translate,
      theme.textSupporting,
      styles.sessionsCalendarMonthLabel,
      styles.sessionsCalendarMonthLabelText,
      styles.sessionsCalendarMonthLabelRule,
      styles.sessionsCalendarMonthLabelTotal,
      styles.ml2,
    ],
  );

  const keyExtractor = useCallback((item: ListItem) => item.key, []);

  const listFooter = useMemo(() => {
    if (!isFetchingOlderMonths) {
      return null;
    }
    return (
      <View style={styles.sessionsCalendarLoadingRow}>
        <ActivityIndicator size="small" color={theme.spinner} />
        <Text style={styles.sessionsCalendarLoadingRowText}>
          {translate('calendar.loadingOlderMonths')}
        </Text>
      </View>
    );
  }, [
    isFetchingOlderMonths,
    styles.sessionsCalendarLoadingRow,
    styles.sessionsCalendarLoadingRowText,
    theme.spinner,
    translate,
  ]);

  const listEmpty = useMemo(
    () => (
      <View style={[styles.flex1, styles.justifyContentCenter, styles.p5]}>
        <Text style={[styles.textSupporting, styles.textAlignCenter]}>
          {translate('dayOverviewScreen.noDrinkingSessions')}
        </Text>
      </View>
    ),
    [
      styles.flex1,
      styles.justifyContentCenter,
      styles.p5,
      styles.textSupporting,
      styles.textAlignCenter,
      translate,
    ],
  );

  return (
    <FlashList
      ref={listRef}
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      stickyHeaderIndices={stickyHeaderIndices}
      initialScrollIndex={targetIndex}
      showsVerticalScrollIndicator
      ListEmptyComponent={listEmpty}
      ListFooterComponent={listFooter}
      onEndReached={onEndReached}
      onEndReachedThreshold={END_REACHED_THRESHOLD}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={VIEWABILITY_CONFIG}
    />
  );
}

DayOverviewListView.displayName = 'DayOverviewListView';
export default memo(DayOverviewListView);
export type {DayOverviewListViewProps};
