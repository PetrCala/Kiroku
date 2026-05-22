/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

import {act, renderHook} from '@testing-library/react-native';
import {addMonths, differenceInMonths, subMonths} from 'date-fns';
import useLazyMarkedDates from '@hooks/useLazyMarkedDates';
import type {Preferences} from '@src/types/onyx';

jest.mock('@hooks/useResolvedPalette', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    green: '#00ff00',
    yellow: '#ffff00',
    orange: '#ff8800',
    red: '#ff0000',
    black: '#000000',
  })),
}));

jest.mock('@userActions/Calendar', () => ({
  __esModule: true,
  setSessionsCalendarMonthsLoadedForUser: jest.fn(),
}));

const TEST_UID = 'user-123';

function makePreferences(): Preferences {
  return {
    first_day_of_week: 'Monday',
    units_to_colors: {orange: 10, yellow: 5},
    drinks_to_units: {
      small_beer: 0.5,
      beer: 1,
      cocktail: 1.5,
      other: 1,
      strong_shot: 1,
      weak_shot: 0.5,
      wine: 1,
    },
    theme: 'system',
  } as unknown as Preferences;
}

function getLoadedFrom(result: {
  current: ReturnType<typeof useLazyMarkedDates>;
}): Date {
  const loadedFrom = result.current.loadedFrom.current;
  if (!loadedFrom) {
    throw new Error('expected loadedFrom.current to be set after render');
  }
  return loadedFrom;
}

describe('useLazyMarkedDates.loadUpTo', () => {
  test('extends loadedMonths to cover the target', () => {
    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, {}, makePreferences()),
    );

    act(() => {
      result.current.loadUpTo(subMonths(new Date(), 5));
    });

    const loadedFrom = getLoadedFrom(result);
    expect(differenceInMonths(new Date(), loadedFrom)).toBeGreaterThanOrEqual(
      5,
    );
  });

  test('shallower target is a no-op (depth never decreases)', () => {
    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, {}, makePreferences()),
    );

    act(() => {
      result.current.loadUpTo(subMonths(new Date(), 5));
    });
    const after5 = getLoadedFrom(result);
    const depthAfter5 = differenceInMonths(new Date(), after5);

    act(() => {
      result.current.loadUpTo(subMonths(new Date(), 3));
    });
    const after3 = getLoadedFrom(result);

    // React bails on equal setState, so the ref points at the same Date object.
    expect(after3).toBe(after5);
    expect(differenceInMonths(new Date(), after3)).toBe(depthAfter5);
  });

  test('future target is a no-op', () => {
    const {result} = renderHook(() =>
      useLazyMarkedDates(TEST_UID, {}, makePreferences()),
    );

    const initial = getLoadedFrom(result);

    act(() => {
      result.current.loadUpTo(addMonths(new Date(), 3));
    });

    expect(result.current.loadedFrom.current).toBe(initial);
  });
});
