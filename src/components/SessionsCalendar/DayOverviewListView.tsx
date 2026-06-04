import React, {memo, useCallback, useEffect, useMemo, useRef} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import type {FlashListRef} from '@shopify/flash-list';
import {format} from 'date-fns';
import lodashDebounce from 'lodash/debounce';
import Text from '@components/Text';
import DrinkingSessionOverview from '@components/DrinkingSessionOverview';
import SwipeBackGestureDetector from '@components/SwipeBackGestureDetector';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
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

// Fraction of the window height left empty below the last (newest) day, so the
// bottom-edge day has room to scroll toward center instead of clamping to the
// bottom. Less than 0.5 keeps the newest session sitting a touch below center
// rather than floating up into the top two-thirds. Tune here.
const BOTTOM_SPACER_RATIO = 0.4;

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
  /** Debounced report of the center-most visible day as the user scrolls — the
   *  screen uses it to open the add-session picker on the viewed month. */
  onVisibleDayChange?: (day: DateString) => void;
  /** Render the session tiles non-interactively (viewing another user's
   *  history). Also suppresses the "last viewed day" persistence so browsing a
   *  friend's days doesn't repoint the current user's own compact calendar. */
  isReadOnly?: boolean;
  /** When true, each session tile shows its edit affordance. Driven by the
   *  day-overview screen's Edit/Done header toggle (self only). */
  isEditModeOn?: boolean;
  /** Dismisses the day-overview modal on a rightward swipe. Omitted in the
   *  embedded (compact calendar) usages where there's no modal to dismiss. */
  onSwipeBack?: () => void;
};

/**
 * Continuous, all-days scroll of the user's drinking sessions.
 *
 * One vertical list: a header per day (date + total units), followed by that
 * day's session tiles. Headers scroll with the content (not pinned) so the
 * focused day's label stays next to its session after the centering scroll.
 * Oldest day first, newest at the bottom — scrolling UP walks back in time and
 * lazily widens the loaded window, matching the `SessionsCalendarWeekListView`
 * direction.
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
  onVisibleDayChange,
  isReadOnly,
  isEditModeOn,
  onSwipeBack,
}: DayOverviewListViewProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {windowHeight} = useWindowDimensions();

  // Room below the newest session so `scrollToIndex({viewPosition: 0.5})` can
  // pull a bottom-edge day toward center instead of clamping it to the bottom.
  // See `BOTTOM_SPACER_RATIO` for the amount.
  const contentContainerStyle = useMemo(
    () => ({paddingBottom: Math.round(windowHeight * BOTTOM_SPACER_RATIO)}),
    [windowHeight],
  );

  // Flatten the day→sessions map into a single list: each day emits a header
  // followed by its sessions (chronological within the day). Build a
  // 'YYYY-MM-DD' → header-index map in the same pass for the initial-scroll
  // lookup. Days are ascending (oldest first, newest at the bottom).
  const {items, dayHeaderIndexByDay, sortedDayKeys} = useMemo(() => {
    const out: ListItem[] = [];
    const headerIndex = new Map<DateString, number>();
    const days = Array.from(sessionEntriesByDay.keys()).sort();

    days.forEach(dayKey => {
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
  // Whether the user has actually dragged the list. Until they do, the only
  // scroll is our programmatic centering, so there's no new position to sync —
  // gating the write on a real drag keeps an open-and-close-without-moving a
  // no-op, so the compact calendar returns to the month the user came from.
  const hasUserScrolledRef = useRef(false);
  const onScrollBeginDrag = useCallback(() => {
    hasUserScrolledRef.current = true;
  }, []);

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
      // Center the focused day in the viewport (context above and below). The
      // list's bottom padding (`contentContainerStyle`) gives the newest day
      // room to settle at center rather than clamping to the bottom edge. The
      // oldest day (no top padding) and short lists still land toward the top.
      listRef.current?.scrollToIndex({
        index: targetIndex,
        animated: false,
        viewPosition: 0.5,
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
  // sync to it on back-navigation, and report it to the screen (for the
  // add-session picker). Debounced; reads the top-most visible item on each
  // viewability change.
  const recordVisibleDay = useMemo(
    () =>
      lodashDebounce((day: DateString) => {
        // Read-only (friend) browsing must not repoint the current user's own
        // compact calendar, which restores from this NVP.
        if (!isReadOnly) {
          App.setLastViewedCalendarDate(day);
        }
        onVisibleDayChange?.(day);
      }, LAST_VIEWED_DEBOUNCE_MS),
    [onVisibleDayChange, isReadOnly],
  );
  useEffect(() => () => recordVisibleDay.cancel(), [recordVisibleDay]);

  // Older sessions live at the top (ascending order), so we lazy-load when the
  // lowest visible index nears index 0 — the mirror image of the week-list's
  // near-top trigger. The same handler records the top-most visible day.
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

      // Sync the *center-most* visible day (not the top-most): the screen opens
      // with the focused day centered (`viewPosition: 0.5`), so the centered
      // day is the one the user perceives they're on. Recording that — rather
      // than the older day clipped at the top edge — makes back-navigation land
      // the compact calendar on the matching month. Only once the user has
      // actually scrolled — otherwise an open-and-close without moving would
      // overwrite the day the user came from.
      if (hasUserScrolledRef.current) {
        const centerIndex =
          visibleIndices[Math.floor(visibleIndices.length / 2)];
        const centerItem = items[centerIndex];
        if (centerItem) {
          recordVisibleDay(centerItem.dayKey);
        }
      }

      if (!onRequestOlder || !canLoadOlder) {
        return;
      }
      if (minIndex > LOAD_AHEAD_BUFFER_ITEMS) {
        return;
      }
      // The earliest visible day is the top-most visible item's day.
      const earliest = items[minIndex];
      if (earliest) {
        onRequestOlder(dateStringToDate(earliest.dayKey));
      }
    },
    [items, onRequestOlder, canLoadOlder, recordVisibleDay],
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
          isEditModeOn={isEditModeOn ?? false}
          readOnly={isReadOnly}
          preferences={preferences}
        />
      );
    },
    [
      preferences,
      isReadOnly,
      isEditModeOn,
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
    <SwipeBackGestureDetector onSwipeBack={onSwipeBack}>
      <FlashList
        ref={listRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        initialScrollIndex={initialScrollIndex}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        onScrollBeginDrag={onScrollBeginDrag}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
      />
    </SwipeBackGestureDetector>
  );
}

DayOverviewListView.displayName = 'DayOverviewListView';
export default memo(DayOverviewListView);
export type {DayOverviewListViewProps};
