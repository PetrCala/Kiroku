import React, {memo, useCallback, useEffect, useMemo, useRef} from 'react';
import {View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import type {FlashListRef} from '@shopify/flash-list';
import {format, parseISO, startOfDay} from 'date-fns';
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

type LabelItem = {
  kind: 'label';
  key: string;
  label: string;
};

type WeekItem = {
  kind: 'week';
  key: string;
  row: WeekRowData;
};

type ListItem = LabelItem | WeekItem;

/**
 * Vertical, continuous week-row calendar.
 *
 * Each month opens with an inline `Mar 2026` label that doubles as a section
 * divider and as the always-visible "where am I" indicator — once the user
 * scrolls past it the label sticks to the top of the viewport until the
 * next month's label arrives (Apple-Photos style). No custom scroll rail;
 * the platform-native scrollbar handles the timeline-position cue.
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

  // Interleave a label item before the first row of each new month so the
  // months are visually distinct AND the label can stick to the top as a
  // section header when scrolled past.
  const {items, stickyHeaderIndices} = useMemo(() => {
    const out: ListItem[] = [];
    const sticky: number[] = [];
    let lastEmittedMonth: number | null = null;
    let lastEmittedYear: number | null = null;

    const pushLabel = (year: number, monthZeroIndexed: number) => {
      const labelDate = new Date(year, monthZeroIndexed, 1);
      const label = format(labelDate, CONST.DATE.MONTH_YEAR_ABBR_FORMAT);
      sticky.push(out.length);
      out.push({
        kind: 'label',
        key: `label-${year}-${monthZeroIndexed}`,
        label,
      });
      lastEmittedMonth = monthZeroIndexed;
      lastEmittedYear = year;
    };

    weekRows.forEach(row => {
      // Determine this row's "primary" month/year — prefer the day-1 cell
      // when the week contains it, otherwise the first non-null day.
      let primaryMonth: number | null = null;
      let primaryYear: number | null = null;
      if (row.isFirstWeekOfMonth && row.monthOfFirstDay !== undefined) {
        primaryMonth = row.monthOfFirstDay;
        primaryYear = row.yearOfFirstDay ?? null;
      } else {
        const firstNonNull = row.days.find(d => d !== null);
        if (firstNonNull) {
          const parts = firstNonNull.split('-').map(Number);
          primaryYear = parts[0];
          primaryMonth = parts[1] - 1;
        }
      }

      if (
        primaryMonth !== null &&
        primaryYear !== null &&
        (primaryMonth !== lastEmittedMonth || primaryYear !== lastEmittedYear)
      ) {
        pushLabel(primaryYear, primaryMonth);
      }

      out.push({kind: 'week', key: row.weekStart, row});
    });

    return {items: out, stickyHeaderIndices: sticky};
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

  const listRef = useRef<FlashListRef<ListItem>>(null);

  // Lazy-load older months when the user scrolls within the buffer of the
  // loaded floor. Surface the earliest visible in-range day to the parent
  // so it can decide whether to widen the loaded window.
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
      // Walk forward from the lowest visible index to find the first week
      // item; labels alone don't carry a day reference.
      for (let i = Math.max(0, minIndex); i < items.length; i++) {
        const item = items[i];
        if (item.kind !== 'week') {
          continue;
        }
        const earliestInRange = item.row.days.find(d => d !== null);
        if (earliestInRange) {
          onRequestOlder(parseISO(earliestInRange));
          return;
        }
      }
    },
    [items, onRequestOlder],
  );

  const renderItem = useCallback(
    (args: {item: ListItem}) => {
      if (args.item.kind === 'label') {
        return (
          <View style={styles.sessionsCalendarMonthLabel}>
            <Text style={styles.sessionsCalendarMonthLabelText}>
              {args.item.label}
            </Text>
            <View style={styles.sessionsCalendarMonthLabelRule} />
          </View>
        );
      }
      return (
        <WeekRow
          row={args.item.row}
          markedDates={markedDates}
          unitsMap={unitsMap}
          today={today}
          onDayPress={onDayPress}
        />
      );
    },
    [
      markedDates,
      unitsMap,
      today,
      onDayPress,
      styles.sessionsCalendarMonthLabel,
      styles.sessionsCalendarMonthLabelText,
      styles.sessionsCalendarMonthLabelRule,
    ],
  );

  const keyExtractor = useCallback((item: ListItem) => item.key, []);

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
      <FlashList
        ref={listRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        stickyHeaderIndices={stickyHeaderIndices}
        initialScrollIndex={Math.max(0, items.length - 1)}
        showsVerticalScrollIndicator
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
      />
    </View>
  );
}

SessionsCalendarWeekListView.displayName = 'SessionsCalendarWeekListView';
export default memo(SessionsCalendarWeekListView);
export type {SessionsCalendarWeekListViewProps};
