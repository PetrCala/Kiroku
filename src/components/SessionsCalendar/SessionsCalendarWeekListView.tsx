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
import buildMonthSections from './buildMonthSections';
import type {MonthSection, MonthWeek} from './buildMonthSections';
import WeekRow from './WeekRow';
import setCalendarLocale from './setCalendarLocale';

const LOAD_AHEAD_BUFFER_WEEKS = 2;
// 50% threshold is generous enough to fire well before the lazy-load buffer
// runs out, but quiet enough not to thrash on every pixel of scroll. The
// previous `1` value was a major contributor to deceleration jitter.
const VIEWABILITY_CONFIG = {itemVisiblePercentThreshold: 50};

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
  row: MonthWeek;
};

type ListItem = LabelItem | WeekItem;

/**
 * Vertical, self-contained-months calendar.
 *
 * Each month is its own mini-grid headed by an inline `Mar 2026` label.
 * Days outside a month are blanks within that month's section so months
 * never bleed into each other. The label sticks to the top of the viewport
 * as the user scrolls past it (Apple-Photos pattern). No custom scroll
 * rail; the platform-native scrollbar carries the timeline-position cue.
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

  const monthSections: MonthSection[] = useMemo(
    () => buildMonthSections({start: resolvedStart, end: resolvedEnd}),
    [resolvedStart, resolvedEnd],
  );

  // Flatten the per-month sections into a single list of items. Labels
  // sit between sections and double as FlashList sticky headers.
  const {items, stickyHeaderIndices} = useMemo(() => {
    const out: ListItem[] = [];
    const sticky: number[] = [];

    monthSections.forEach(section => {
      const labelDate = new Date(section.year, section.month, 1);
      sticky.push(out.length);
      out.push({
        kind: 'label',
        key: `label-${section.year}-${section.month}`,
        label: format(labelDate, CONST.DATE.MONTH_YEAR_ABBR_FORMAT),
      });
      section.weeks.forEach(week => {
        // Section-qualified key — two halves of a calendar week that spans
        // a month boundary share the same `week.key` (the Monday's ISO
        // date), so without the section prefix React reconciliation would
        // see a duplicate and drop one of them. Concretely: October's
        // last row and November's first row both start Mon 2025-10-27.
        out.push({
          kind: 'week',
          key: `week-${section.year}-${section.month}-${week.key}`,
          row: week,
        });
      });
    });

    return {items: out, stickyHeaderIndices: sticky};
  }, [monthSections]);

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
  // loaded floor. Walk forward from the lowest visible index to the first
  // week item with at least one in-range day; surface that day to the
  // parent so it can decide whether to widen the loaded window. Walking
  // forward handles label items and leading-blank week rows at the top
  // of the very first month section.
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
