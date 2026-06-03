import React, {memo, useCallback, useEffect, useMemo, useRef} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
import {FlashList} from '@shopify/flash-list';
import type {FlashListRef} from '@shopify/flash-list';
import {format, parseISO, startOfDay} from 'date-fns';
import lodashDebounce from 'lodash/debounce';
import type {DateData} from 'react-native-calendars';
import {LocaleConfig} from 'react-native-calendars';
import type {MarkedDates} from 'react-native-calendars/src/types';
import {useOnyx} from 'react-native-onyx';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import ONYXKEYS from '@src/ONYXKEYS';
import CONST from '@src/CONST';
import * as App from '@userActions/App';
import {roundToTwoDecimalPlaces} from '@libs/NumberUtils';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import buildMonthSections from './buildMonthSections';
import type {MonthSection, MonthWeek} from './buildMonthSections';
import WeekRow from './WeekRow';
import setCalendarLocale from './setCalendarLocale';

// Trigger `onRequestOlder` when the lowest visible item is within this
// many weeks of index 0. Generous so the parent's prefetch starts well
// before the user catches up to the loaded floor.
const LOAD_AHEAD_BUFFER_WEEKS = 12;

// Fraction of the window height left empty below the latest week so
// `scrollToIndex({viewPosition: 0.5})` can pull a near-latest target toward
// center instead of clamping it to the bottom. Mirrors the day-overview's
// spacer so both views center their target identically.
const BOTTOM_SPACER_RATIO = 0.4;

// 50% threshold is generous enough to fire well before the lazy-load buffer
// runs out, but quiet enough not to thrash on every pixel of scroll. The
// previous `1` value was a major contributor to deceleration jitter.
const VIEWABILITY_CONFIG = {itemVisiblePercentThreshold: 50};

type SessionsCalendarWeekListViewProps = {
  /** Marked dates payload keyed by `DateString`. */
  markedDates: MarkedDates;
  /** Per-day unit count, also keyed by `DateString`. */
  unitsMap: Map<DateString, number>;
  /** Per-month unit totals keyed by 'YYYY-MM'. Rendered in the month label. */
  monthlyTotalsMap: Map<string, number>;
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
  /** Target month ('YYYY-MM') to center on first render. When omitted, the
   *  list falls back to "latest at bottom". */
  initialMonthYear?: string;
  /** Fires once the initial scroll has been applied (or determined that no
   *  scroll is needed). The parent screen uses this to unhide the calendar. */
  onInitialScrollReady?: () => void;
  /** Called when the user swipes right past the threshold — the parent maps
   *  this to a navigation back so the fullscreen view feels dismissable on
   *  Android (which has no built-in stack swipe-back). */
  onSwipeBack?: () => void;
};

type LabelItem = {
  kind: 'label';
  key: string;
  label: string;
  monthKey: string;
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
  monthlyTotalsMap,
  loadedFromDate,
  endDate,
  isFetchingOlderMonths,
  onDayPress,
  onRequestOlder,
  initialMonthYear,
  onInitialScrollReady,
  onSwipeBack,
}: SessionsCalendarWeekListViewProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {windowHeight} = useWindowDimensions();
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
      const monthKey = `${section.year}-${String(section.month + 1).padStart(2, '0')}`;
      sticky.push(out.length);
      out.push({
        kind: 'label',
        key: `label-${section.year}-${section.month}`,
        label: format(labelDate, CONST.DATE.MONTH_YEAR_ABBR_FORMAT),
        monthKey,
      });
      section.weeks.forEach((week, weekIdx) => {
        if (weekIdx === 0) {
          // The first week-row of each section is what we anchor the
          // initial-scroll lookup against. Key by 'YYYY-MM'.
          monthIndex.set(monthKey, out.length);
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
  const hasAppliedInitialScrollRef = useRef(false);

  // Resolve the target index — undefined while data hasn't loaded enough
  // months yet (the items memo widens as `loadedFromDate` extends).
  const targetIndex = useMemo(() => {
    if (!initialMonthYear) {
      return undefined;
    }
    return firstWeekIndexByMonth.get(initialMonthYear);
  }, [initialMonthYear, firstWeekIndexByMonth]);

  const wantsInitialScroll = !!initialMonthYear;

  useEffect(() => {
    if (hasAppliedInitialScrollRef.current) {
      return;
    }
    if (!wantsInitialScroll) {
      hasAppliedInitialScrollRef.current = true;
      onInitialScrollReady?.();
      return;
    }
    if (targetIndex === undefined) {
      // Waiting for the data fetcher to widen the loaded range so the
      // target month enters `items`. The effect will re-fire on `items`.
      return;
    }
    // Center the target month's first week-row, mirroring the day-overview's
    // centered open. The bottom spacer (`contentContainerStyle`) gives a
    // near-latest target room to reach center rather than clamping to the
    // bottom edge.
    listRef.current?.scrollToIndex({
      index: targetIndex,
      animated: false,
      viewPosition: 0.5,
    });
    hasAppliedInitialScrollRef.current = true;
    onInitialScrollReady?.();
  }, [items, targetIndex, wantsInitialScroll, onInitialScrollReady]);

  // Room below the newest week so `scrollToIndex({viewPosition: 0.5})` can pull
  // a near-latest target toward center instead of clamping it to the bottom.
  const contentContainerStyle = useMemo(
    () => ({paddingBottom: Math.round(windowHeight * BOTTOM_SPACER_RATIO)}),
    [windowHeight],
  );

  // Record the month the user is looking at so the compact calendar can sync
  // to it on back-navigation. Debounced so a fast scroll writes once at rest.
  const writeLastViewedDay = useMemo(
    () =>
      lodashDebounce((day: DateString) => {
        App.setLastViewedCalendarDate(day);
      }, 250),
    [],
  );
  useEffect(() => () => writeLastViewedDay.cancel(), [writeLastViewedDay]);

  // Lazy-load older months when the user scrolls within the buffer of the
  // loaded floor. Walk forward from the lowest visible index to the first
  // week item with at least one in-range day; surface that day to the
  // parent so it can decide whether to widen the loaded window. Walking
  // forward handles label items and leading-blank week rows at the top
  // of the very first month section.
  const onViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: Array<{index: number | null}>}) => {
      const visibleIndices = viewableItems
        .map(item => item.index)
        .filter((index): index is number => index !== null)
        .sort((a, b) => a - b);
      if (visibleIndices.length === 0) {
        return;
      }
      const minIndex = visibleIndices[0];

      // Surface the *center-most* visible month as the "last viewed" date, so
      // backing out to the compact calendar lands on the month the user is
      // focused on (matching the centered open) rather than a sliver clipped
      // at the top edge.
      const centerItem =
        items[visibleIndices[Math.floor(visibleIndices.length / 2)]];
      if (centerItem) {
        const centerDay =
          centerItem.kind === 'label'
            ? (`${centerItem.monthKey}-01` as DateString)
            : centerItem.row.days.find(d => d !== null);
        if (centerDay) {
          writeLastViewedDay(centerDay);
        }
      }

      if (!onRequestOlder) {
        return;
      }
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
    [items, onRequestOlder, writeLastViewedDay],
  );

  const renderItem = useCallback(
    (args: {item: ListItem}) => {
      if (args.item.kind === 'label') {
        const total = monthlyTotalsMap.get(args.item.monthKey);
        return (
          <View style={styles.sessionsCalendarMonthLabel}>
            <Text style={styles.sessionsCalendarMonthLabelText}>
              {args.item.label}
            </Text>
            <View style={styles.sessionsCalendarMonthLabelRule} />
            {total !== undefined && total > 0 && (
              <Text style={styles.sessionsCalendarMonthLabelTotal}>
                {translate('calendar.monthTotalUnits', {
                  unitCount: roundToTwoDecimalPlaces(total),
                })}
              </Text>
            )}
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
      monthlyTotalsMap,
      onDayPress,
      translate,
      styles.sessionsCalendarMonthLabel,
      styles.sessionsCalendarMonthLabelText,
      styles.sessionsCalendarMonthLabelRule,
      styles.sessionsCalendarMonthLabelTotal,
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

  // Side-swipe-right → dismiss the fullscreen view. The Pan gesture only
  // activates on a clear horizontal drift, and fails the moment a vertical
  // drift takes the lead, so the FlashList's vertical scroll wins every
  // intra-list pan. `enabled` keeps the gesture inert when no handler is
  // wired up (e.g. a future reuse of this view outside the modal stack).
  const swipeBackGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!!onSwipeBack)
        // Only positive translation (rightward swipe) should be a candidate;
        // we leave a generous failOffset on the left so dragging the
        // scrollbar / horizontal day-row never accidentally trips it.
        .activeOffsetX(20)
        .failOffsetY([-20, 20])
        .onEnd(e => {
          'worklet';

          const SWIPE_THRESHOLD = 80;
          const VELOCITY_THRESHOLD = 500;
          if (!onSwipeBack) {
            return;
          }
          if (
            e.translationX > SWIPE_THRESHOLD ||
            e.velocityX > VELOCITY_THRESHOLD
          ) {
            runOnJS(onSwipeBack)();
          }
        }),
    [onSwipeBack],
  );

  return (
    <GestureDetector gesture={swipeBackGesture}>
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
            data={items}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            stickyHeaderIndices={stickyHeaderIndices}
            initialScrollIndex={initialScrollIndex}
            contentContainerStyle={contentContainerStyle}
            showsVerticalScrollIndicator
            ListHeaderComponent={listHeader}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={VIEWABILITY_CONFIG}
          />
        </View>
      </View>
    </GestureDetector>
  );
}

SessionsCalendarWeekListView.displayName = 'SessionsCalendarWeekListView';
export default memo(SessionsCalendarWeekListView);
export type {SessionsCalendarWeekListViewProps};
