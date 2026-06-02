import React, {memo, useCallback, useEffect, useMemo, useRef} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import type {FlashListRef} from '@shopify/flash-list';
import {format} from 'date-fns';
import lodashDebounce from 'lodash/debounce';
import Text from '@components/Text';
import DrinkingSessionOverview from '@components/DrinkingSessionOverview';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {dateStringToDate} from '@libs/DataHandling';
import {roundToTwoDecimalPlaces} from '@libs/NumberUtils';
import * as App from '@userActions/App';
import CONST from '@src/CONST';
import type {Preferences} from '@src/types/onyx';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import type DrinkingSessionKeyValue from '@src/types/utils/databaseUtils';

// Trigger an older-window fetch once the lowest visible item is within this
// many items of the top of the list (index 0). Generous so the parent's
// prefetch starts well before the user reaches the loaded floor. Mirrors the
// week-list view's `LOAD_AHEAD_BUFFER_WEEKS`.
const LOAD_AHEAD_BUFFER_ITEMS = 12;

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
  /** False once the loaded window reaches the user's earliest session — stops
   *  the older-fetch trigger and hides the "loading older" header. */
  canLoadOlder?: boolean;
  /** True while the data fetcher is widening the loaded window; renders a
   *  "Loading older months…" row at the top of the list. */
  isFetchingOlderMonths?: boolean;
  /** Called when the user scrolls within `LOAD_AHEAD_BUFFER_ITEMS` of the top;
   *  receives the earliest visible day so the parent can decide whether to
   *  widen the loaded window. */
  onRequestOlder?: (earliestVisible: Date) => void;
  /** Day ('YYYY-MM-DD') to land on at first render. Falls back to the nearest
   *  session day at-or-before it when the exact day has no sessions. */
  initialDay?: DateString;
  /** Fires once the initial scroll has been applied (or determined that no
   *  scroll is needed). The parent screen uses this to unhide the list. */
  onInitialScrollReady?: () => void;
};

/**
 * Continuous, all-days scroll of the user's drinking sessions.
 *
 * One vertical list: a sticky header per day (date + total units), followed by
 * that day's session tiles. Oldest day first, newest at the bottom — scrolling
 * UP walks back in time and lazily widens the loaded window, matching the
 * `SessionsCalendarWeekListView` direction.
 */
function DayOverviewListView({
  sessionEntriesByDay,
  unitsMap,
  preferences,
  canLoadOlder,
  isFetchingOlderMonths,
  onRequestOlder,
  initialDay,
  onInitialScrollReady,
}: DayOverviewListViewProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();

  // Flatten the day→sessions map into a single list: each day emits a header
  // followed by its sessions (chronological within the day). Build the sticky
  // header indices and a 'YYYY-MM-DD' → header-index map in the same pass for
  // the initial-scroll lookup. Days are ascending (oldest first, newest at the
  // bottom).
  const {items, stickyHeaderIndices, dayHeaderIndexByDay, sortedDayKeys} =
    useMemo(() => {
      const out: ListItem[] = [];
      const sticky: number[] = [];
      const headerIndex = new Map<DateString, number>();
      const days = Array.from(sessionEntriesByDay.keys()).sort();

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
  // session day at-or-before it (days are ascending, so the largest key <=
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
    let fallbackDay: DateString | undefined;
    for (const day of sortedDayKeys) {
      if (day <= initialDay) {
        fallbackDay = day;
      } else {
        break;
      }
    }
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
    // No matching day yet. If we can't load any older data (window already
    // covers the user's earliest session) or there's nothing to show, stop
    // waiting and reveal the list. Otherwise wait for the orchestrator to
    // widen the window; this effect re-fires on `items`.
    if (canLoadOlder === false || items.length === 0) {
      hasAppliedInitialScrollRef.current = true;
      onInitialScrollReady?.();
    }
  }, [
    initialDay,
    targetIndex,
    items.length,
    canLoadOlder,
    onInitialScrollReady,
  ]);

  // Record the day the user is looking at so the home/profile calendar can
  // sync to it on back-navigation. Debounced; reads the top-most visible item
  // on each viewability change.
  const writeLastViewedDay = useMemo(
    () =>
      lodashDebounce((day: DateString) => {
        App.setLastViewedCalendarDate(day);
      }, LAST_VIEWED_DEBOUNCE_MS),
    [],
  );
  useEffect(() => () => writeLastViewedDay.cancel(), [writeLastViewedDay]);

  // Older sessions live at the top (ascending order), so we lazy-load when the
  // lowest visible index nears index 0 — the mirror image of the week-list's
  // near-top trigger. The same handler records the top-most visible day.
  const onViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: Array<{index: number | null}>}) => {
      if (viewableItems.length === 0) {
        return;
      }
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

      if (!onRequestOlder || !canLoadOlder) {
        return;
      }
      if (minIndex > LOAD_AHEAD_BUFFER_ITEMS) {
        return;
      }
      // The earliest visible day is the top-most visible item's day.
      const earliest = items[Math.max(0, minIndex)];
      if (earliest) {
        onRequestOlder(dateStringToDate(earliest.dayKey));
      }
    },
    [items, onRequestOlder, canLoadOlder, writeLastViewedDay],
  );

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
      translate,
      styles.sessionsCalendarMonthLabel,
      styles.sessionsCalendarMonthLabelText,
      styles.sessionsCalendarMonthLabelRule,
      styles.sessionsCalendarMonthLabelTotal,
    ],
  );

  const keyExtractor = useCallback((item: ListItem) => item.key, []);

  // Sits above the oldest loaded day (the top of the list) — only while an
  // older-data fetch is in flight, signaling "more on the way".
  const listHeader = useMemo(() => {
    if (!isFetchingOlderMonths || !canLoadOlder) {
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
    canLoadOlder,
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

  // Land on the focused day, otherwise on the newest sessions (bottom).
  const initialScrollIndex = targetIndex ?? Math.max(0, items.length - 1);

  return (
    <FlashList
      ref={listRef}
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      stickyHeaderIndices={stickyHeaderIndices}
      initialScrollIndex={initialScrollIndex}
      showsVerticalScrollIndicator
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={VIEWABILITY_CONFIG}
    />
  );
}

DayOverviewListView.displayName = 'DayOverviewListView';
export default memo(DayOverviewListView);
export type {DayOverviewListViewProps};
