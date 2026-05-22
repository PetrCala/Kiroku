import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {View} from 'react-native';
import type {NativeScrollEvent, NativeSyntheticEvent} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import type {FlashListRef} from '@shopify/flash-list';
import {format, parseISO, startOfDay} from 'date-fns';
import {useSharedValue} from 'react-native-reanimated';
import type {DateData} from 'react-native-calendars';
import {LocaleConfig} from 'react-native-calendars';
import type {MarkedDates} from 'react-native-calendars/src/types';
import {useOnyx} from 'react-native-onyx';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import ONYXKEYS from '@src/ONYXKEYS';
import CONST from '@src/CONST';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import buildWeekRows from './buildWeekRows';
import type {WeekRow as WeekRowData} from './buildWeekRows';
import WeekRow from './WeekRow';
import SessionsCalendarMonthRail from './SessionsCalendarMonthRail';
import type {MonthEntry} from './SessionsCalendarMonthRail';
import setCalendarLocale from './setCalendarLocale';

const LOAD_AHEAD_BUFFER_WEEKS = 2;

const VIEWABILITY_CONFIG = {itemVisiblePercentThreshold: 1};

type SessionsCalendarWeekListViewProps = {
  /** Marked dates payload keyed by `DateString`. */
  markedDates: MarkedDates;
  /** Per-day unit count, also keyed by `DateString`. */
  unitsMap: Map<DateString, number>;
  /** Earliest day currently loaded (drives the bottom of the list). */
  loadedFromDate: Date | null;
  /** Latest day to render (defaults to today). */
  endDate?: Date;
  /** Day cell tap handler. */
  onDayPress?: (day: DateData) => void;
  /** Called when the user scrolls within `LOAD_AHEAD_BUFFER_WEEKS` of the
   *  loaded floor; receives the date of the earliest in-range day currently
   *  visible. The parent decides (via `computeLoadTarget`) whether to
   *  actually widen the loaded window. */
  onRequestOlder?: (earliestVisible: Date) => void;
};

/**
 * Vertical, continuous week-row calendar.
 *
 * Renders one row per ISO week from `loadedFromDate` to today via FlashList.
 * Days outside the loaded range are blanked. A sticky day-name strip sits
 * above the list; a vertical month/year rail is anchored to the right edge
 * and slides a Reanimated highlighter in sync with the list's scroll.
 *
 * Pure presentational — no Onyx writes, no Firebase reads. The parent owns
 * extending the loaded range via `onRequestOlder`.
 */
function SessionsCalendarWeekListView({
  markedDates,
  unitsMap,
  loadedFromDate,
  endDate,
  onDayPress,
  onRequestOlder,
}: SessionsCalendarWeekListViewProps) {
  const styles = useThemeStyles();
  const [preferredLocale] = useOnyx(ONYXKEYS.NVP_PREFERRED_LOCALE);
  const locale = preferredLocale ?? CONST.LOCALES.DEFAULT;

  useEffect(() => {
    setCalendarLocale(locale);
  }, [locale]);

  const resolvedEnd = useMemo(
    () => startOfDay(endDate ?? new Date()),
    [endDate],
  );
  const resolvedStart = useMemo(
    () => (loadedFromDate ? startOfDay(loadedFromDate) : resolvedEnd),
    [loadedFromDate, resolvedEnd],
  );

  const weekRows: WeekRowData[] = useMemo(
    () => buildWeekRows({start: resolvedStart, end: resolvedEnd}),
    [resolvedStart, resolvedEnd],
  );

  // Derive the month/year rail entries from weekRows. Each entry covers from
  // its `firstWeekIndex` to the next entry's first index (or the end of the
  // list). The label is the localized "MMM YY" short form.
  const months: MonthEntry[] = useMemo(() => {
    const entries: MonthEntry[] = [];
    weekRows.forEach((row, index) => {
      if (!row.isFirstWeekOfMonth || row.monthOfFirstDay === undefined) {
        return;
      }
      const monthDate = new Date(
        row.yearOfFirstDay ?? 0,
        row.monthOfFirstDay,
        1,
      );
      entries.push({
        month: row.monthOfFirstDay,
        year: row.yearOfFirstDay ?? 0,
        firstWeekIndex: index,
        weekSpan: 0,
        label: format(monthDate, CONST.DATE.MONTH_YEAR_ABBR_FORMAT),
      });
    });
    // Fill in weekSpan.
    for (let i = 0; i < entries.length; i++) {
      const next = entries[i + 1];
      entries[i].weekSpan = next
        ? next.firstWeekIndex - entries[i].firstWeekIndex
        : weekRows.length - entries[i].firstWeekIndex;
    }
    return entries;
  }, [weekRows]);

  const dayNames = useMemo(() => {
    // `LocaleConfig` is re-exported from xdate without precise TS types for
    // `.locales`. Cast through `unknown` to a narrow record so the lookup
    // is type-safe at call sites.
    const locales = (
      LocaleConfig as unknown as {
        locales: Record<string, {dayNamesShort?: string[]} | undefined>;
      }
    ).locales;
    const config = locales[locale] ?? locales.en;
    const names = config?.dayNamesShort ?? [
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
    ];
    // `LocaleConfig` is keyed by Sunday=0. Rotate to start with `firstDay`.
    const firstDay = CONST.WEEK_STARTS_ON;
    return Array.from({length: 7}, (_, i) => names[(firstDay + i) % 7]);
  }, [locale]);

  const today: DateString = useMemo(
    () => format(resolvedEnd, CONST.DATE.FNS_FORMAT_STRING) as DateString,
    [resolvedEnd],
  );

  // Scroll position + content size feed the rail highlighter. We use a
  // plain JS `onScroll` (not `useAnimatedScrollHandler`) because FlashList
  // 2.x's RecyclerView calls `.call(...)` on whatever you pass — and the
  // Reanimated handler object isn't a plain function, which crashes the
  // dispatch. The highlighter's `useAnimatedStyle` still runs on the UI
  // thread; only the input update hops via the JS thread.
  const scrollY = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  // Plain function (not memoized): SharedValue mutation can't go inside a
  // `useCallback` per `react-hooks/immutability`, and FlashList stores
  // `onScroll` without depending on its identity, so churn is fine.
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

  const listRef = useRef<FlashListRef<WeekRowData>>(null);

  const handleJumpToWeek = useCallback((weekIndex: number) => {
    listRef.current?.scrollToIndex({
      index: weekIndex,
      animated: true,
      viewPosition: 0,
    });
  }, []);

  // Lazy-load older months when the user scrolls within the buffer of the
  // loaded floor. FlashList's `onViewableItemsChanged` fires with viewable
  // index info — when the lowest visible index gets close to 0, surface the
  // earliest in-range visible day to the parent so it can decide whether to
  // widen the loaded window.
  const onViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: Array<{index: number | null}>}) => {
      if (!onRequestOlder || viewableItems.length === 0) {
        return;
      }
      let minIndex = Number.POSITIVE_INFINITY;
      viewableItems.forEach(item => {
        if (item.index !== null && item.index < minIndex) {
          minIndex = item.index;
        }
      });
      if (minIndex > LOAD_AHEAD_BUFFER_WEEKS) {
        return;
      }
      const row = weekRows[Math.max(0, minIndex)];
      if (!row) {
        return;
      }
      const earliestInRange = row.days.find(d => d !== null);
      if (!earliestInRange) {
        return;
      }
      onRequestOlder(parseISO(earliestInRange));
    },
    [onRequestOlder, weekRows],
  );

  const renderItem = useCallback(
    (args: {item: WeekRowData}) => (
      <WeekRow
        row={args.item}
        markedDates={markedDates}
        unitsMap={unitsMap}
        today={today}
        onDayPress={onDayPress}
      />
    ),
    [markedDates, unitsMap, today, onDayPress],
  );

  const keyExtractor = useCallback((item: WeekRowData) => item.weekStart, []);

  // Helps the visible-month/load heuristic feel right even before the user
  // scrolls — the rail starts highlighting the current month.
  const [hasMeasuredContent, setHasMeasuredContent] = useState(false);

  return (
    <View style={styles.flex1}>
      <View style={styles.sessionsCalendarDayNamesRow}>
        {dayNames.map((name, idx) => (
          <View
            // eslint-disable-next-line react/no-array-index-key
            key={`day-name-${idx}`}
            style={styles.sessionsCalendarDayNameCell}>
            <Text style={styles.sessionsCalendarDayNameText}>{name}</Text>
          </View>
        ))}
      </View>
      <View style={styles.flex1}>
        <FlashList
          ref={listRef}
          data={weekRows}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          initialScrollIndex={Math.max(0, weekRows.length - 1)}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.sessionsCalendarWeekListContent}
          onContentSizeChange={(_, h) => {
            contentHeight.value = h;
            if (!hasMeasuredContent) {
              setHasMeasuredContent(true);
            }
          }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
        />
        <SessionsCalendarMonthRail
          months={months}
          totalWeeks={weekRows.length}
          scrollY={scrollY}
          contentHeight={contentHeight}
          onJumpToWeek={handleJumpToWeek}
        />
      </View>
    </View>
  );
}

SessionsCalendarWeekListView.displayName = 'SessionsCalendarWeekListView';
export default memo(SessionsCalendarWeekListView);
export type {SessionsCalendarWeekListViewProps};
