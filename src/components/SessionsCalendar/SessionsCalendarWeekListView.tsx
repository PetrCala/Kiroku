import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {ActivityIndicator, Dimensions, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import type {FlashListRef} from '@shopify/flash-list';
import {format, parseISO, startOfDay} from 'date-fns';
import type {DateData} from 'react-native-calendars';
import {LocaleConfig} from 'react-native-calendars';
import type {MarkedDates} from 'react-native-calendars/src/types';
import {useOnyx} from 'react-native-onyx';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import ONYXKEYS from '@src/ONYXKEYS';
import CONST from '@src/CONST';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import buildMonthSections from './buildMonthSections';
import type {MonthSection, MonthWeek} from './buildMonthSections';
import WeekRow from './WeekRow';
import setCalendarLocale from './setCalendarLocale';

// Trigger `onRequestOlder` when the lowest visible item is within this
// many weeks of index 0. Generous so the parent's prefetch starts well
// before the user catches up to the loaded floor.
const LOAD_AHEAD_BUFFER_WEEKS = 12;

// Mirrors `styles.sessionsCalendarWeekRow.paddingVertical`. The compact
// calendar's row uses *marginVertical*, so a measured day cell sits at the
// row frame's top; the fullscreen row's *paddingVertical* offsets cells by
// this amount inside the frame. We subtract it from the scroll math so the
// compact and fullscreen tile rows overlay pixel-perfectly.
const WEEK_ROW_VERTICAL_PADDING = 6;

// Rough per-item heights used only for sizing the bottom spacer. Deliberate
// over-estimates so the spacer math errs toward 0 (rather than leaving an
// over-tall tail of empty space below the latest month).
const APPROX_WEEK_ROW_HEIGHT = 48;
const APPROX_LABEL_HEIGHT = 56;

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
  /** True while the data fetcher is widening the loaded window. The view
   *  renders a "Loading older months…" row at the top of the list while
   *  this is true. */
  isFetchingOlderMonths?: boolean;
  /** Day cell tap handler. */
  onDayPress?: (day: DateData) => void;
  /** Called when the user scrolls within `LOAD_AHEAD_BUFFER_WEEKS` of the
   *  loaded floor; receives the date of the earliest in-range day currently
   *  visible. The parent decides (via `computeLoadTarget`) whether to
   *  actually widen the loaded window. */
  onRequestOlder?: (earliestVisible: Date) => void;
  /** Target month ('YYYY-MM') to land at on first render, with its first
   *  week-row positioned at window-Y `initialFirstWeekY`. When omitted, the
   *  list falls back to "latest at bottom". */
  initialMonthYear?: string;
  /** Window-Y (px) where the target month's first week-row should land. */
  initialFirstWeekY?: number;
  /** Fires once the initial scroll has been applied (or determined that no
   *  scroll is needed). The parent screen uses this to unhide the calendar. */
  onInitialScrollReady?: () => void;
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
  isFetchingOlderMonths,
  onDayPress,
  onRequestOlder,
  initialMonthYear,
  initialFirstWeekY,
  onInitialScrollReady,
}: SessionsCalendarWeekListViewProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
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
  // sit between sections and double as FlashList sticky headers. We also
  // build a `monthYear → first-week-row index` map in the same pass for
  // the initial-scroll lookup.
  const {items, stickyHeaderIndices, firstWeekIndexByMonth} = useMemo(() => {
    const out: ListItem[] = [];
    const sticky: number[] = [];
    const monthIndex = new Map<string, number>();

    monthSections.forEach(section => {
      const labelDate = new Date(section.year, section.month, 1);
      sticky.push(out.length);
      out.push({
        kind: 'label',
        key: `label-${section.year}-${section.month}`,
        label: format(labelDate, CONST.DATE.MONTH_YEAR_ABBR_FORMAT),
      });
      section.weeks.forEach((week, weekIdx) => {
        if (weekIdx === 0) {
          // The first week-row of each section is what we anchor the
          // initial-scroll lookup against. Key by 'YYYY-MM'.
          const key = `${section.year}-${String(section.month + 1).padStart(2, '0')}`;
          monthIndex.set(key, out.length);
        }
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

    return {
      items: out,
      stickyHeaderIndices: sticky,
      firstWeekIndexByMonth: monthIndex,
    };
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

  const listRef = useRef<FlashListRef<ListItem>>(null);

  // Window-Y (px) of the FlashList's top edge, captured via the wrapper
  // View's onLayout. `null` until first layout pass. Stored in state (not
  // a ref) so the apply-scroll effect re-runs once it's known.
  const flashListWrapperRef = useRef<View | null>(null);
  const [flashTopY, setFlashTopY] = useState<number | null>(null);
  const hasAppliedInitialScrollRef = useRef(false);

  const onFlashListWrapperLayout = useCallback(() => {
    // `onLayout` reports local coordinates — measure against the window so
    // we can compare against the small calendar's measured Y.
    if (!flashListWrapperRef.current) {
      return;
    }
    flashListWrapperRef.current.measureInWindow((_x, y) => {
      setFlashTopY(y);
    });
  }, []);

  // Resolve the target index — undefined while data hasn't loaded enough
  // months yet (the items memo widens as `loadedFromDate` extends).
  const targetIndex = useMemo(() => {
    if (!initialMonthYear) {
      return undefined;
    }
    return firstWeekIndexByMonth.get(initialMonthYear);
  }, [initialMonthYear, firstWeekIndexByMonth]);

  const wantsInitialScroll =
    !!initialMonthYear && initialFirstWeekY !== undefined;

  useEffect(() => {
    if (hasAppliedInitialScrollRef.current) {
      return;
    }
    if (!wantsInitialScroll) {
      hasAppliedInitialScrollRef.current = true;
      onInitialScrollReady?.();
      return;
    }
    if (flashTopY === null) {
      return;
    }
    if (targetIndex === undefined) {
      // Waiting for the data fetcher to widen the loaded range so the
      // target month enters `items`. The effect will re-fire on `items`.
      return;
    }
    if (initialFirstWeekY === undefined) {
      return;
    }
    // FlashList's `scrollToIndex({viewPosition: 0, viewOffset})` lands the
    // row at the top of the visible area, then shifts the final offset by
    // `viewOffset` (positive = item moves up = scroll further). We want the
    // tile row's *cells* — not the row frame — at window-Y
    // `initialFirstWeekY`. The frame top sits `WEEK_ROW_VERTICAL_PADDING`
    // above the cells, so we land the frame top at
    // `initialFirstWeekY - WEEK_ROW_VERTICAL_PADDING`, i.e. an effective
    // delta of `(initialFirstWeekY - WEEK_ROW_VERTICAL_PADDING) - flashTopY`.
    const delta = initialFirstWeekY - WEEK_ROW_VERTICAL_PADDING - flashTopY;
    listRef.current?.scrollToIndex({
      index: targetIndex,
      animated: false,
      viewPosition: 0,
      viewOffset: -delta,
    });
    hasAppliedInitialScrollRef.current = true;
    onInitialScrollReady?.();
  }, [
    items,
    flashTopY,
    targetIndex,
    initialFirstWeekY,
    wantsInitialScroll,
    onInitialScrollReady,
  ]);

  // Bottom spacer — only needed when there isn't enough content below the
  // target row to scroll it up to `initialFirstWeekY`. For past targets the
  // months below the target already fill the screen, so this clamps to 0.
  // For the latest month we add just enough headroom — the distance from
  // the target Y to the bottom of the screen, minus the (approximate)
  // height of the rows that already sit below the target in the list.
  const footerHeight = useMemo(() => {
    if (!wantsInitialScroll || initialFirstWeekY === undefined) {
      return 0;
    }
    if (targetIndex === undefined) {
      return 0;
    }
    let weeksBelow = 0;
    let labelsBelow = 0;
    for (let i = targetIndex + 1; i < items.length; i++) {
      if (items[i].kind === 'week') {
        weeksBelow++;
      } else {
        labelsBelow++;
      }
    }
    const approxHeightBelowTarget =
      weeksBelow * APPROX_WEEK_ROW_HEIGHT + labelsBelow * APPROX_LABEL_HEIGHT;
    const windowHeight = Dimensions.get('window').height;
    return Math.max(
      0,
      windowHeight - initialFirstWeekY - approxHeightBelowTarget,
    );
  }, [wantsInitialScroll, initialFirstWeekY, targetIndex, items]);

  const ListFooter = useMemo(
    () => <View style={{height: footerHeight}} />,
    [footerHeight],
  );

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
          onDayPress={onDayPress}
        />
      );
    },
    [
      markedDates,
      unitsMap,
      onDayPress,
      styles.sessionsCalendarMonthLabel,
      styles.sessionsCalendarMonthLabelText,
      styles.sessionsCalendarMonthLabelRule,
    ],
  );

  const keyExtractor = useCallback((item: ListItem) => item.key, []);

  // FlashList renders this above the first item in the list — i.e. above
  // the oldest loaded week. It only shows while a data fetch is in flight,
  // signaling "more months are on the way" when the user has scrolled past
  // the prefetch buffer and is waiting on the network.
  const listHeader = useMemo(() => {
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

  // When we have a target, seed `initialScrollIndex` to it so we land close
  // to the right place even before the corrective `scrollToIndex` lands —
  // avoids a noticeable pre-scroll flash from the latest month on Android.
  // The `opacity: 0` parent on the screen hides this entirely, but it's
  // good belt-and-suspenders.
  const initialScrollIndex =
    wantsInitialScroll && targetIndex !== undefined
      ? targetIndex
      : Math.max(0, items.length - 1);

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
      <View
        ref={flashListWrapperRef}
        onLayout={onFlashListWrapperLayout}
        style={styles.flex1}
        collapsable={false}>
        <FlashList
          ref={listRef}
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          stickyHeaderIndices={stickyHeaderIndices}
          initialScrollIndex={initialScrollIndex}
          showsVerticalScrollIndicator
          ListHeaderComponent={listHeader}
          ListFooterComponent={ListFooter}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
        />
      </View>
    </View>
  );
}

SessionsCalendarWeekListView.displayName = 'SessionsCalendarWeekListView';
export default memo(SessionsCalendarWeekListView);
export type {SessionsCalendarWeekListViewProps};
