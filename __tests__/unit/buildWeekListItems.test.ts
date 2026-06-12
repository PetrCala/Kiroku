import buildWeekListItems from '@components/SessionsCalendar/buildWeekListItems';
import {deriveCalendarMonth} from '@components/SessionsCalendar/deriveCalendarMonth';
import type {CalendarMonthData} from '@components/SessionsCalendar/deriveCalendarMonth';
import type {Preferences} from '@src/types/onyx';

const FAR_FLOOR = new Date(2010, 0, 1);

function makePreferences(): Preferences {
  return {
    first_day_of_week: 'Monday',
    units_to_colors: {orange: 10, yellow: 5},
    drinks_to_units: {beer: 1},
    session_color_palette: {
      green: '#00ff00',
      yellow: '#ffff00',
      orange: '#ff8800',
      red: '#ff0000',
      black: '#000000',
    },
    theme: 'system',
  } as unknown as Preferences;
}

/** A sessionless derived month — geometry only, like a freshly loaded month. */
function makeMonth(year: number, month: number): CalendarMonthData {
  return deriveCalendarMonth({
    year,
    month,
    monthEntriesByDay: undefined,
    effectivePreferences: makePreferences(),
    endClamp: null,
  });
}

describe('buildWeekListItems', () => {
  test('a pending month and its later real version produce identical keys and row counts', () => {
    const march = makeMonth(2026, 2);
    const april = makeMonth(2026, 3);

    // After the data lands: March and April are both real.
    const loaded = buildWeekListItems({
      months: [march, april],
      renderFromDate: null,
      pendingMonthCount: 0,
      absoluteFloor: FAR_FLOOR,
    });
    // Before the data lands: April is the floor, March renders pending.
    const pendingBuild = buildWeekListItems({
      months: [april],
      renderFromDate: null,
      pendingMonthCount: 1,
      absoluteFloor: FAR_FLOOR,
    });

    const aprilLabelIndex = loaded.items.findIndex(
      item => item.key === 'label-2026-3',
    );
    const marchRealKeys = loaded.items
      .slice(0, aprilLabelIndex)
      .map(item => item.key);
    const marchPendingItems = pendingBuild.items.slice(
      0,
      pendingBuild.firstRealIndex,
    );

    // The in-place swap guarantee: identical keys, in order, same row count.
    expect(marchPendingItems.map(item => item.key)).toEqual(marchRealKeys);
    expect(marchPendingItems.every(item => item.pending)).toBe(true);
    // The pending label still shows the real month name.
    expect(marchPendingItems[0]).toMatchObject({
      kind: 'label',
      label: 'Mar 2026',
    });
    // And the real build has nothing pending.
    expect(loaded.items.some(item => item.pending)).toBe(false);
    expect(loaded.firstRealIndex).toBe(0);
  });

  test('sticky header indices point at the label items', () => {
    const result = buildWeekListItems({
      months: [makeMonth(2026, 2), makeMonth(2026, 3)],
      renderFromDate: null,
      pendingMonthCount: 0,
      absoluteFloor: FAR_FLOOR,
    });
    expect(result.stickyHeaderIndices.length).toBe(2);
    result.stickyHeaderIndices.forEach(index => {
      expect(result.items[index].kind).toBe('label');
    });
  });

  test('pending months never cross the absolute floor', () => {
    const result = buildWeekListItems({
      months: [makeMonth(2026, 3)],
      renderFromDate: null,
      pendingMonthCount: 5,
      // Floor at Feb 2026 — only Feb and Mar may render pending.
      absoluteFloor: new Date(2026, 1, 1),
    });
    const pendingLabels = result.items.filter(
      item => item.kind === 'label' && item.pending,
    );
    expect(pendingLabels.map(item => item.key)).toEqual([
      'label-2026-1',
      'label-2026-2',
    ]);
  });

  test('renderFromDate adds dimmed (non-pending, data-less) months and indexes them as scroll targets', () => {
    const result = buildWeekListItems({
      months: [makeMonth(2026, 3)],
      renderFromDate: new Date(2026, 1, 1),
      pendingMonthCount: 0,
      absoluteFloor: FAR_FLOOR,
    });

    expect(result.items.some(item => item.pending)).toBe(false);
    expect(result.firstRealIndex).toBe(0);
    const firstLabel = result.items[0];
    expect(firstLabel).toMatchObject({kind: 'label', monthKey: '2026-02'});
    const firstWeek = result.items[1];
    expect(firstWeek.kind).toBe('week');
    if (firstWeek.kind === 'week') {
      expect(firstWeek.dayData.size).toBe(0);
    }
    // Dimmed months are valid centering targets (the pre-tracking open fix).
    expect(result.firstWeekIndexByMonth.has('2026-02')).toBe(true);
    expect(result.firstWeekIndexByMonth.has('2026-03')).toBe(true);
    expect(result.firstWeekIndexByMonth.has('2026-04')).toBe(true);
  });

  test('pending months win over renderFromDate (zones never overlap)', () => {
    const result = buildWeekListItems({
      months: [makeMonth(2026, 3)],
      renderFromDate: new Date(2026, 1, 1),
      pendingMonthCount: 1,
      absoluteFloor: FAR_FLOOR,
    });

    // Only March renders below the floor — as a pending month; the dimmed
    // zone (which would have added February) is skipped.
    const belowFloorLabels = result.items.filter(
      item => item.kind === 'label' && item.monthKey !== '2026-04',
    );
    expect(belowFloorLabels.map(item => item.key)).toEqual(['label-2026-2']);
    expect(belowFloorLabels[0].pending).toBe(true);
    // Pending months are not centering targets.
    expect(result.firstWeekIndexByMonth.has('2026-03')).toBe(false);
    expect(result.firstRealIndex).toBeGreaterThan(0);
    expect(result.items[result.firstRealIndex].pending).toBe(false);
  });

  test('no months yields an empty list', () => {
    const result = buildWeekListItems({
      months: [],
      renderFromDate: null,
      pendingMonthCount: 3,
      absoluteFloor: FAR_FLOOR,
    });
    expect(result.items).toEqual([]);
    expect(result.firstRealIndex).toBe(0);
  });
});
