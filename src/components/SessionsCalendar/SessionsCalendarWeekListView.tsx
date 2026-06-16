import React, {memo, useCallback, useEffect, useMemo, useRef} from 'react';
import {View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import type {FlashListRef} from '@shopify/flash-list';
import {parseISO, startOfMonth} from 'date-fns';
import lodashDebounce from 'lodash/debounce';
import type {DateData} from 'react-native-calendars';
import {LocaleConfig} from 'react-native-calendars';
import {useOnyx} from 'react-native-onyx';
import SwipeBackGestureDetector from '@components/SwipeBackGestureDetector';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import ONYXKEYS from '@src/ONYXKEYS';
import CONST from '@src/CONST';
import * as App from '@userActions/App';
import {roundToTwoDecimalPlaces} from '@libs/NumberUtils';
import DateUtils from '@libs/DateUtils';
import setCalendarLocale from '@libs/setCalendarLocale';
import {canSyncGlobalLastViewedDate} from '@libs/SessionsCalendarUtils';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import buildWeekListItems from './buildWeekListItems';
import type {ListItem} from './buildWeekListItems';
import type {CalendarMonthData} from './deriveCalendarMonth';
import WeekRow from './WeekRow';
import WeekRowSkeleton from './WeekRowSkeleton';

// Trigger `onRequestOlder` when the lowest visible item is within this
// many weeks of the first real (non-pending) item. Generous so the parent's
// prefetch starts well before the user catches up to the loaded floor; being
// anywhere inside the pending-skeleton zone always triggers.
const LOAD_AHEAD_BUFFER_WEEKS = 12;

// How many months of pending skeletons to render above the loaded floor while
// older data can still arrive (`canLoadOlder`). ~1.5 viewports of runway — the
// parent's 6-month widen chunk refills faster than a user can cross it, so the
// list reads as "loading" rather than ending at a hard edge. Their keys and
// geometry are identical to the real months that replace them, so the swap is
// an in-place repaint with zero scroll jump.
const PENDING_SKELETON_MONTHS = 3;

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
  /** Per-month render payloads, ascending. Month objects are referentially
   *  stable across loaded-window widens (see `useLazyMarkedDates`), so rows of
   *  already-loaded months never re-render when older months stream in. */
  calendarMonths: CalendarMonthData[];
  /** Render-only floor (self): months between it and the data floor render as
   *  dimmed pre-tracking months (clickable, no data). Pass the data floor (or
   *  null) to render no extra months. */
  renderFromDate: Date | null;
  /** Whether scrolling back can still reveal older data. While true, the list
   *  renders pending skeleton months above the loaded floor instead of a hard
   *  edge. */
  canLoadOlder?: boolean;
  /** Earliest tracked day ('yyyy-MM-dd'). Days before it render dimmed but stay
   *  clickable. Styling-only; the parent decides how far the list renders. */
  trackingStartDate?: string;
  /** Day cell tap handler. */
  onDayPress?: (day: DateData) => void;
  /** Day cell long-press handler (create-session shortcut). */
  onDayLongPress?: (day: DateData) => void;
  /** Called when the user scrolls within `LOAD_AHEAD_BUFFER_WEEKS` of the
   *  loaded floor (or into the pending zone); receives the date of the
   *  earliest in-range day currently visible. The parent decides (via
   *  `computeLoadTarget`) whether to actually widen the loaded window. */
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
  /** Read-only (a friend's) calendar. When true, scrolling must NOT record the
   *  last-viewed day: `NVP_LAST_VIEWED_CALENDAR_DATE` is a single global key the
   *  signed-in user's OWN compact calendar restores from, so a friend's scroll
   *  would repoint home/self onto the friend's month (mirrors `DayOverviewListView`). */
  isReadOnly?: boolean;
};

/**
 * Vertical, self-contained-months calendar.
 *
 * Each month is its own mini-grid headed by an inline `Mar 2026` label.
 * Days outside a month are blanks within that month's section so months
 * never bleed into each other. The label sticks to the top of the viewport
 * as the user scrolls past it (Apple-Photos pattern). No custom scroll
 * rail; the platform-native scrollbar carries the timeline-position cue.
 *
 * While older data can still arrive, the months above the loaded floor render
 * as skeleton rows (real month labels, placeholder day tiles) so the user
 * scrolls into "loading" rather than a hard edge; the rows fill in place when
 * the data lands.
 *
 * Pure presentational — no Onyx writes, no Firebase reads. The parent owns
 * extending the loaded range via `onRequestOlder`.
 */
function SessionsCalendarWeekListView({
  calendarMonths,
  renderFromDate,
  canLoadOlder,
  trackingStartDate,
  onDayPress,
  onDayLongPress,
  onRequestOlder,
  initialMonthYear,
  onInitialScrollReady,
  onSwipeBack,
  isReadOnly,
}: SessionsCalendarWeekListViewProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {windowHeight} = useWindowDimensions();
  const [preferredLocale] = useOnyx(ONYXKEYS.NVP_PREFERRED_LOCALE);
  const locale = preferredLocale ?? CONST.LOCALES.DEFAULT;
  // Explicit date-fns locale for the month labels — date-fns ignores the global
  // default unless `locale` is passed (see SessionsCalendarView for the rationale).
  const dateFnsLocale = DateUtils.getDateFnsLocale(locale);

  useEffect(() => {
    setCalendarLocale(locale);
  }, [locale]);

  // The product's 20-year horizon — neither the pending-skeleton zone nor the
  // pre-tracking dimmed zone renders past it.
  const absoluteFloor = useMemo(
    () => startOfMonth(CONST.CALENDAR_PICKER.MIN_DATE),
    [],
  );

  const {items, stickyHeaderIndices, firstWeekIndexByMonth, firstRealIndex} =
    useMemo(
      () =>
        buildWeekListItems({
          months: calendarMonths,
          renderFromDate,
          pendingMonthCount: canLoadOlder ? PENDING_SKELETON_MONTHS : 0,
          absoluteFloor,
          dateFnsLocale,
        }),
      [
        calendarMonths,
        renderFromDate,
        canLoadOlder,
        absoluteFloor,
        dateFnsLocale,
      ],
    );

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
  // FlashList v2 renders nothing on its first cycle: it measures itself and its
  // rows, then fires `onLoad`. Only after that are the real row heights known.
  // The initial centering scroll must wait for it — applied earlier (e.g. in a
  // mount effect, as this used to do) it runs against v2's 200px-per-row
  // default estimate, lands at the wrong offset, and on Android leaves the list
  // blank until a manual scroll re-engages the renderer (the reported bug).
  // This flips true in `onLoad`.
  const hasLoadedRef = useRef(false);
  // Whether the user has actually dragged the list. Until they do, the only
  // scroll is our programmatic centering, so there's no new position to sync —
  // syncing then would write whatever the centering math reports (a neighbour
  // month for a short latest month). Gating the write on a real drag keeps an
  // open-and-close-without-moving a no-op: the compact calendar stays put.
  const hasUserScrolledRef = useRef(false);
  const onScrollBeginDrag = useCallback(() => {
    hasUserScrolledRef.current = true;
  }, []);

  // Resolve the target index — undefined while data hasn't loaded enough
  // months yet (the items memo widens as the loaded range extends; pending
  // months don't count as a landing target).
  const targetIndex = useMemo(() => {
    if (!initialMonthYear) {
      return undefined;
    }
    return firstWeekIndexByMonth.get(initialMonthYear);
  }, [initialMonthYear, firstWeekIndexByMonth]);

  const wantsInitialScroll = !!initialMonthYear;

  // Apply the one-time initial scroll, then reveal the calendar (via
  // `onInitialScrollReady`). Runs only once `onLoad` has fired, so the scroll
  // is computed against measured rows: `scrollToIndex` steps toward the target,
  // measuring rows along the way (so it lands precisely) and re-engaging the
  // renderer (so Android actually paints). Revealing only after the returned
  // promise settles avoids a visible jump. Idempotent — safe to call from both
  // `onLoad` and the data-widening effect below.
  const maybeApplyInitialScroll = useCallback(() => {
    if (hasAppliedInitialScrollRef.current || !hasLoadedRef.current) {
      return;
    }
    // Scroll, then reveal once the scroll settles (avoids a visible jump). Falls
    // back to an immediate reveal if the ref somehow isn't attached, so the
    // screen never hangs on its skeleton waiting for a scroll that can't run.
    const reveal = () => onInitialScrollReady?.();
    const list = listRef.current;
    const scrollThenReveal = (index: number, viewPosition?: number) => {
      hasAppliedInitialScrollRef.current = true;
      if (list) {
        list
          .scrollToIndex({index, animated: false, viewPosition})
          .then(reveal, reveal);
      } else {
        reveal();
      }
    };
    if (targetIndex !== undefined) {
      // Center the target month's first week-row, mirroring the day-overview's
      // centered open. The bottom spacer (`contentContainerStyle`) gives a
      // near-latest target room to reach center rather than clamping to the
      // bottom edge.
      scrollThenReveal(targetIndex, 0.5);
      return;
    }
    if (!wantsInitialScroll) {
      // No target month requested — land on the latest weeks (bottom),
      // matching `initialScrollIndex`'s fallback, and reveal.
      scrollThenReveal(Math.max(0, items.length - 1));
    }
    // Otherwise the target month isn't in the loaded range yet — wait for the
    // data fetcher to widen it; the effect below re-fires as `items` grows.
  }, [items.length, targetIndex, wantsInitialScroll, onInitialScrollReady]);

  const handleListLoad = useCallback(() => {
    hasLoadedRef.current = true;
    maybeApplyInitialScroll();
  }, [maybeApplyInitialScroll]);

  // Re-attempt the initial scroll when the loaded range widens (the target
  // month entering `items`) or when `onLoad` arrives. No-op until `onLoad` has
  // set `hasLoadedRef`.
  useEffect(() => {
    maybeApplyInitialScroll();
  }, [maybeApplyInitialScroll]);

  // Room below the newest week so `scrollToIndex({viewPosition: 0.5})` can pull
  // a near-latest target toward center instead of clamping it to the bottom.
  const contentContainerStyle = useMemo(
    () => ({paddingBottom: Math.round(windowHeight * BOTTOM_SPACER_RATIO)}),
    [windowHeight],
  );

  // Record the month the user is looking at so the compact calendar can sync
  // to it on back-navigation. Debounced so a fast scroll writes once at rest.
  // Read-only (friend) browsing must not repoint the current user's own compact
  // calendar, which restores from this global NVP (mirrors `DayOverviewListView`).
  const writeLastViewedDay = useMemo(
    () =>
      lodashDebounce((day: DateString) => {
        if (canSyncGlobalLastViewedDate(isReadOnly)) {
          App.setLastViewedCalendarDate(day);
        }
      }, 250),
    [isReadOnly],
  );
  useEffect(() => () => writeLastViewedDay.cancel(), [writeLastViewedDay]);

  // Lazy-load older months when the user scrolls within the buffer of the
  // first real (non-pending) item — anywhere inside the pending-skeleton zone
  // included. Walk forward from the lowest visible index to the first week
  // item with at least one in-range day; surface that day to the parent so it
  // can decide whether to widen the loaded window. Pending rows carry real
  // dates, so scrolling deep into the skeletons asks for correspondingly
  // older months.
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
      // at the top edge. Only once the user has actually scrolled — otherwise
      // an open-and-close without moving would overwrite the origin month.
      // Pending months don't count: they have no data yet, and pointing the
      // compact calendar at one would land it on an unloaded month.
      if (hasUserScrolledRef.current) {
        const centerItem =
          items[visibleIndices[Math.floor(visibleIndices.length / 2)]];
        if (centerItem && !centerItem.pending) {
          const centerDay =
            centerItem.kind === 'label'
              ? (`${centerItem.monthKey}-01` as DateString)
              : centerItem.row.days.find(d => d !== null);
          if (centerDay) {
            writeLastViewedDay(centerDay);
          }
        }
      }

      if (!onRequestOlder) {
        return;
      }
      if (minIndex - firstRealIndex > LOAD_AHEAD_BUFFER_WEEKS) {
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
    [items, firstRealIndex, onRequestOlder, writeLastViewedDay],
  );

  const renderItem = useCallback(
    (args: {item: ListItem}) => {
      if (args.item.kind === 'label') {
        const total = args.item.totalUnits;
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
      if (args.item.pending) {
        return <WeekRowSkeleton row={args.item.row} />;
      }
      return (
        <WeekRow
          row={args.item.row}
          dayData={args.item.dayData}
          trackingStartDate={trackingStartDate}
          onDayPress={onDayPress}
          onDayLongPress={onDayLongPress}
        />
      );
    },
    [
      trackingStartDate,
      onDayPress,
      onDayLongPress,
      translate,
      styles.sessionsCalendarMonthLabel,
      styles.sessionsCalendarMonthLabelText,
      styles.sessionsCalendarMonthLabelRule,
      styles.sessionsCalendarMonthLabelTotal,
    ],
  );

  const keyExtractor = useCallback((item: ListItem) => item.key, []);

  // Distinct recycling pools (and per-type size estimates) for the two row
  // shapes — a one-line month label vs. a full week grid-row. v2 keys its
  // running height estimate by type, so this also sharpens the offset math that
  // `initialScrollIndex`/`scrollToIndex` rely on. Pending rows share the
  // 'week' pool deliberately: their geometry is pixel-identical, which keeps
  // the offset math consistent across the skeleton→data swap.
  const getItemType = useCallback((item: ListItem) => item.kind, []);

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
    <SwipeBackGestureDetector onSwipeBack={onSwipeBack}>
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
          getItemType={getItemType}
          stickyHeaderIndices={stickyHeaderIndices}
          initialScrollIndex={initialScrollIndex}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator
          onLoad={handleListLoad}
          onScrollBeginDrag={onScrollBeginDrag}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
        />
      </View>
    </SwipeBackGestureDetector>
  );
}

SessionsCalendarWeekListView.displayName = 'SessionsCalendarWeekListView';
export default memo(SessionsCalendarWeekListView);
export type {SessionsCalendarWeekListViewProps};
