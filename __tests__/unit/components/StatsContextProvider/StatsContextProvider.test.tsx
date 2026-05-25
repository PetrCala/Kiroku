/* eslint-disable @typescript-eslint/naming-convention -- jest mock keys */
import {act, render} from '@testing-library/react-native';
import React from 'react';
import StatsContextProvider from '@components/StatsContextProvider';
import useStatsContext from '@hooks/useStatsContext';
import type {StatsContextValue} from '@components/StatsContextProvider';

let mockOnyxValue: unknown;
jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {
    merge: jest.fn(() => Promise.resolve()),
    connect: jest.fn(() => 0),
    disconnect: jest.fn(),
    set: jest.fn(() => Promise.resolve()),
    init: jest.fn(),
  },
  useOnyx: () => [mockOnyxValue, {status: 'loaded'}],
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-member-access, rulesdir/prefer-actions-set-data
const merge = require('react-native-onyx').default.merge as jest.Mock;


jest.mock('@hooks/useCurrentUserData', () => ({
  __esModule: true,
  default: () => ({userID: 'u1', earliest_session_at: 1_700_000_000_000}),
}));

jest.mock('@context/global/FirebaseContext', () => ({
  useFirebase: () => ({auth: {currentUser: {uid: 'u1'}}}),
}));

const NOW = new Date('2026-05-15T12:00:00Z');

const capturedRef: {current: StatsContextValue | null} = {current: null};

function Probe() {
  const ctxValue = useStatsContext();
  // eslint-disable-next-line react-compiler/react-compiler, react-hooks/immutability
  capturedRef.current = ctxValue;
  return null;
}

function renderProvider() {
  render(
    <StatsContextProvider now={NOW}>
      <Probe />
    </StatsContextProvider>,
  );
}

function getCtx(): StatsContextValue {
  if (!capturedRef.current) {
    throw new Error('Probe never reported a context value');
  }
  return capturedRef.current;
}

beforeEach(() => {
  merge.mockClear();
  mockOnyxValue = undefined;
  capturedRef.current = null;
});

describe('StatsContextProvider', () => {
  it('uses the documented defaults on first mount', () => {
    renderProvider();

    expect(getCtx().range.preset).toBe('M');
    expect(getCtx().comparison).toBe('none');
    expect(getCtx().drinkTypeFilter.size).toBe(0);
    expect(getCtx().userIds).toEqual(['u1']);
  });

  it('setRange("W") recomputes start/end via derivePresetRange', () => {
    renderProvider();
    const startBefore = getCtx().range.start;

    act(() => {
      getCtx().setRange({preset: 'W'});
    });

    expect(getCtx().range.preset).toBe('W');
    expect(getCtx().range.start.getTime()).not.toBe(startBefore.getTime());
    expect(merge).toHaveBeenLastCalledWith('statisticsFilters', {
      preset: 'W',
      customStart: undefined,
      customEnd: undefined,
    });
  });

  it('setRange Custom stores both dates and persists them as ISO strings', () => {
    renderProvider();
    const start = new Date('2026-01-10T00:00:00Z');
    const end = new Date('2026-02-20T23:59:59Z');

    act(() => {
      getCtx().setRange({preset: 'Custom', start, end});
    });

    expect(getCtx().range.preset).toBe('Custom');
    expect(getCtx().range.start).toEqual(start);
    expect(getCtx().range.end).toEqual(end);
    expect(merge).toHaveBeenLastCalledWith(
      'statisticsFilters',
      expect.objectContaining({
        preset: 'Custom',
        customStart: '2026-01-10',
        customEnd: '2026-02-20',
      }),
    );
  });

  it('setDrinkTypeFilter persists as an array and updates the Set', () => {
    renderProvider();

    act(() => {
      getCtx().setDrinkTypeFilter(new Set(['beer']));
    });

    expect(getCtx().drinkTypeFilter.has('beer')).toBe(true);
    expect(merge).toHaveBeenLastCalledWith('statisticsFilters', {
      drinkTypeFilter: ['beer'],
    });
  });

  it('rehydrates preset and drinkTypeFilter from Onyx; comparison still resets to none', () => {
    mockOnyxValue = {
      preset: 'Custom',
      customStart: '2026-01-10',
      customEnd: '2026-02-20',
      drinkTypeFilter: ['wine', 'cocktail'],
    };

    renderProvider();

    expect(getCtx().range.preset).toBe('Custom');
    expect(getCtx().range.start.getFullYear()).toBe(2026);
    expect(getCtx().range.start.getMonth()).toBe(0);
    expect(getCtx().range.end.getMonth()).toBe(1);
    expect(Array.from(getCtx().drinkTypeFilter).sort()).toEqual([
      'cocktail',
      'wine',
    ]);
    expect(getCtx().comparison).toBe('none');
  });
});
