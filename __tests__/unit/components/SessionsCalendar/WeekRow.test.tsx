/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
import {fireEvent, render} from '@testing-library/react-native';
import React from 'react';
import WeekRow from '@components/SessionsCalendar/WeekRow';
import type {MonthWeek} from '@components/SessionsCalendar/buildMonthSections';
import type {DayCellData} from '@components/SessionsCalendar/deriveCalendarMonth';
import HapticFeedback from '@libs/HapticFeedback';
import type {DateString} from '@src/types/onyx/OnyxCommon';

jest.mock('@libs/HapticFeedback', () => ({
  __esModule: true,
  default: {
    press: jest.fn(),
    longPress: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const GREEN = '#008000';
const ORANGE = '#FFA500';

// Mon 2026-09-07 .. Sun 2026-09-13, with the last two cells blank (as the
// builder nulls days outside the loaded range).
const row: MonthWeek = {
  key: '2026-09-07',
  days: [
    '2026-09-07',
    '2026-09-08',
    '2026-09-09',
    '2026-09-10',
    '2026-09-11',
    null,
    null,
  ],
};

const dayData: ReadonlyMap<DateString, DayCellData> = new Map<
  DateString,
  DayCellData
>([
  ['2026-09-07', {marking: {color: GREEN, isAlcoholFree: true}}],
  ['2026-09-08', {marking: {color: ORANGE}, units: 6.5}],
  ['2026-09-09', {marking: {color: GREEN, isAlcoholFree: true}}],
  ['2026-09-10', {marking: {color: ORANGE}, units: 3}],
  ['2026-09-11', {marking: {color: GREEN, isAlcoholFree: true}}],
]);

type Style = Record<string, unknown>;
const flattenStyle = (style: unknown): Style =>
  ([] as unknown[])
    .concat(style ?? [])
    .filter(Boolean)
    .reduce<Style>((acc, s) => ({...acc, ...(s as Style)}), {});

describe('SessionsCalendar WeekRow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a pressable per day, keeps blanks blank, and flags days with sessions', () => {
    const {getByTestId, queryByTestId, toJSON} = render(
      <WeekRow row={row} dayData={dayData} />,
    );
    row.days.forEach(day => {
      if (day) {
        expect(getByTestId(`calendar-day-${day}`)).toBeTruthy();
      }
    });
    // Only days that hold sessions carry the second identifier.
    expect(getByTestId('calendar-day-2026-09-08-has-sessions')).toBeTruthy();
    expect(queryByTestId('calendar-day-2026-09-07-has-sessions')).toBeNull();
    // Unit counts render as in the compact grid: decimals kept, integers bare.
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"6.5"');
    expect(json).toContain('"3"');
    // Two blank cells, no pressable in them.
    expect(json.match(/calendar-day-/g)).toHaveLength(5 + 2);
  });

  it('reports a press with the same DateData payload as the compact grid', () => {
    const onDayPress = jest.fn();
    const {getByTestId} = render(
      <WeekRow row={row} dayData={dayData} onDayPress={onDayPress} />,
    );
    fireEvent.press(getByTestId('calendar-day-2026-09-10'));
    expect(onDayPress).toHaveBeenCalledWith({
      dateString: '2026-09-10',
      day: 10,
      month: 9,
      year: 2026,
      timestamp: new Date(2026, 8, 10).getTime(),
    });
  });

  it('fires the long-press haptic and callback, and stays inert without a handler', () => {
    const onDayLongPress = jest.fn();
    const {getByTestId, rerender} = render(
      <WeekRow row={row} dayData={dayData} onDayLongPress={onDayLongPress} />,
    );
    fireEvent(getByTestId('calendar-day-2026-09-08'), 'longPress');
    expect(HapticFeedback.longPress).toHaveBeenCalledTimes(1);
    expect(onDayLongPress).toHaveBeenCalledWith(
      expect.objectContaining({dateString: '2026-09-08'}),
    );

    // A friend's calendar passes no long-press handler: no haptic either.
    rerender(<WeekRow row={row} dayData={dayData} />);
    fireEvent(getByTestId('calendar-day-2026-09-08'), 'longPress');
    expect(HapticFeedback.longPress).toHaveBeenCalledTimes(1);
  });

  it('dims pre-tracking days and hides their units, but keeps them pressable', () => {
    const onDayPress = jest.fn();
    const {getByTestId, toJSON} = render(
      <WeekRow
        row={row}
        dayData={dayData}
        trackingStartDate="2026-09-09"
        onDayPress={onDayPress}
      />,
    );
    const pressable = getByTestId('calendar-day-2026-09-08');
    const tile = pressable.children[0];
    expect(typeof tile).not.toBe('string');
    const tileStyle = flattenStyle(
      (tile as {props: {style: unknown}}).props.style,
    );
    expect(tileStyle.opacity).toBe(0.35);
    expect(JSON.stringify(toJSON())).not.toContain('"6.5"');
    fireEvent.press(pressable);
    expect(onDayPress).toHaveBeenCalledWith(
      expect.objectContaining({dateString: '2026-09-08'}),
    );
    // The tracked day after the floor is drawn at full strength.
    const tracked = getByTestId('calendar-day-2026-09-10').children[0];
    expect(
      flattenStyle((tracked as {props: {style: unknown}}).props.style).opacity,
    ).toBe(1);
  });
});
