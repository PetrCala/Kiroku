import {format, startOfMonth, subDays, subMonths} from 'date-fns';
import type {Locale as DateFnsLocale} from 'date-fns';
import CONST from '@src/CONST';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import buildMonthSections from './buildMonthSections';
import type {MonthWeek} from './buildMonthSections';
import type {CalendarMonthData, DayCellData} from './deriveCalendarMonth';
import {toMonthKey} from './deriveCalendarMonth';

// Shared empty payload for months that render without derived data (pending
// skeletons and pre-tracking dimmed months). A single frozen instance keeps
// row props referentially stable.
const EMPTY_DAY_DATA: ReadonlyMap<DateString, DayCellData> = new Map();

type LabelItem = {
  kind: 'label';
  key: string;
  label: string;
  monthKey: string;
  /** Month's unit total, rendered after the label rule. Undefined for pending
   *  and pre-tracking months (and hidden when 0). */
  totalUnits?: number;
  /** True while the month's data hasn't loaded yet (skeleton state). */
  pending: boolean;
};

type WeekItem = {
  kind: 'week';
  key: string;
  row: MonthWeek;
  /** Per-day cell payload for the row's month. `EMPTY_DAY_DATA` for pending
   *  and pre-tracking months. */
  dayData: ReadonlyMap<DateString, DayCellData>;
  /** True while the month's data hasn't loaded yet — rendered as a skeleton
   *  row instead of day tiles. */
  pending: boolean;
};

type ListItem = LabelItem | WeekItem;

type BuildWeekListItemsArgs = {
  /** Derived data months, ascending (from `useLazyMarkedDates`). */
  months: CalendarMonthData[];
  /** Render-only floor (self): months in `[renderFromDate, data floor)` render
   *  as dimmed pre-tracking months with no data. Ignored while pending months
   *  are active (the two zones are mutually exclusive at the call site; the
   *  guard here is defensive). */
  renderFromDate: Date | null;
  /** How many months of pending skeletons to render below the data floor.
   *  Pass 0 when no older data can arrive. */
  pendingMonthCount: number;
  /** Absolute oldest month to render — neither zone crosses it. */
  absoluteFloor: Date;
  /** date-fns locale for the month labels — date-fns ignores the global
   *  default unless `locale` is passed explicitly (see SessionsCalendarView).
   *  Omitted (e.g. in tests) it falls back to date-fns' default (English). */
  dateFnsLocale?: DateFnsLocale;
};

type BuildWeekListItemsResult = {
  items: ListItem[];
  /** Indices of the label items (FlashList sticky headers). */
  stickyHeaderIndices: number[];
  /** 'YYYY-MM' → index of the month's first week row, for the initial-scroll
   *  lookup. Pending months are excluded — a centering target must wait for
   *  its data. */
  firstWeekIndexByMonth: Map<string, number>;
  /** Index of the first non-pending item — the viewability trigger measures
   *  the user's distance from this, so being inside the skeleton zone always
   *  requests more. */
  firstRealIndex: number;
};

/**
 * Flatten derived months (plus optional pending-skeleton and pre-tracking
 * zones) into the fullscreen week-list's item array.
 *
 * The item key scheme (`label-${year}-${month}`, `week-${year}-${month}-` +
 * the week's ISO-Monday key) is shared by all three zones and is derived from
 * pure date math, so a pending month and the real month that later replaces it
 * produce IDENTICAL keys, row counts, and row heights. Data landing is an
 * in-place content swap — no insert/remove at the scroll anchor, hence no
 * jump.
 */
function buildWeekListItems({
  months,
  renderFromDate,
  pendingMonthCount,
  absoluteFloor,
  dateFnsLocale,
}: BuildWeekListItemsArgs): BuildWeekListItemsResult {
  const items: ListItem[] = [];
  const stickyHeaderIndices: number[] = [];
  const firstWeekIndexByMonth = new Map<string, number>();

  const pushMonth = (args: {
    year: number;
    month: number;
    weeks: MonthWeek[];
    dayData: ReadonlyMap<DateString, DayCellData>;
    pending: boolean;
    totalUnits?: number;
  }) => {
    const monthKey = toMonthKey(args.year, args.month);
    stickyHeaderIndices.push(items.length);
    items.push({
      kind: 'label',
      key: `label-${args.year}-${args.month}`,
      label: format(
        new Date(args.year, args.month, 1),
        CONST.DATE.MONTH_YEAR_ABBR_FORMAT,
        {locale: dateFnsLocale},
      ),
      monthKey,
      totalUnits: args.totalUnits,
      pending: args.pending,
    });
    args.weeks.forEach((week, weekIdx) => {
      if (weekIdx === 0 && !args.pending) {
        firstWeekIndexByMonth.set(monthKey, items.length);
      }
      // Section-qualified key — two halves of a calendar week that spans
      // a month boundary share the same `week.key` (the Monday's ISO
      // date), so without the section prefix React reconciliation would
      // see a duplicate and drop one of them. Concretely: October's
      // last row and November's first row both start Mon 2025-10-27.
      items.push({
        kind: 'week',
        key: `week-${args.year}-${args.month}-${week.key}`,
        row: week,
        dayData: args.dayData,
        pending: args.pending,
      });
    });
  };

  const dataFloor =
    months.length > 0 ? new Date(months[0].year, months[0].month, 1) : null;

  // Zone 1 — pending skeleton months, oldest first, directly below the data
  // floor. Active only while older data can still arrive.
  if (pendingMonthCount > 0 && dataFloor && dataFloor > absoluteFloor) {
    let pendingStart = startOfMonth(subMonths(dataFloor, pendingMonthCount));
    if (pendingStart < absoluteFloor) {
      pendingStart = absoluteFloor;
    }
    buildMonthSections({
      start: pendingStart,
      end: subDays(dataFloor, 1),
    }).forEach(section => {
      pushMonth({
        year: section.year,
        month: section.month,
        weeks: section.weeks,
        dayData: EMPTY_DAY_DATA,
        pending: true,
      });
    });
  }

  const firstRealIndex = items.length;

  // Zone 2 — pre-tracking dimmed months (self): real rows with no data, days
  // styled dimmed-but-clickable via `trackingStartDate` so the user can add a
  // past session. Mutually exclusive with zone 1 (self never has pending
  // months); skipped defensively if both were ever requested.
  if (
    pendingMonthCount === 0 &&
    renderFromDate &&
    dataFloor &&
    renderFromDate < dataFloor
  ) {
    let dimmedStart = startOfMonth(renderFromDate);
    if (dimmedStart < absoluteFloor) {
      dimmedStart = absoluteFloor;
    }
    buildMonthSections({
      start: dimmedStart,
      end: subDays(dataFloor, 1),
    }).forEach(section => {
      pushMonth({
        year: section.year,
        month: section.month,
        weeks: section.weeks,
        dayData: EMPTY_DAY_DATA,
        pending: false,
      });
    });
  }

  // Zone 3 — derived data months.
  months.forEach(monthData => {
    pushMonth({
      year: monthData.year,
      month: monthData.month,
      weeks: monthData.weeks,
      dayData: monthData.dayData,
      pending: false,
      totalUnits: monthData.totalUnits,
    });
  });

  return {items, stickyHeaderIndices, firstWeekIndexByMonth, firstRealIndex};
}

export default buildWeekListItems;
export type {ListItem, LabelItem, WeekItem, BuildWeekListItemsArgs};
