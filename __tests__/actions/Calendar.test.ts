/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/prefer-actions-set-data -- this test references the mocked Onyx.merge/set to assert what the action issues; it is not app code */

import ONYXKEYS from '@src/ONYXKEYS';
import * as Calendar from '@userActions/Calendar';
import Onyx from 'react-native-onyx';

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(() => 1),
    disconnect: jest.fn(),
    merge: jest.fn(() => Promise.resolve()),
    set: jest.fn(() => Promise.resolve()),
    METHOD: {MERGE: 'merge', SET: 'set'},
  },
  useOnyx: jest.fn(),
}));

const mockedMerge = jest.mocked(Onyx.merge);
const mockedSet = jest.mocked(Onyx.set);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('resetCalendarStateForColdLaunch', () => {
  it('clears both calendar sync keys with merge(key, null)', () => {
    // Regression: `Onyx.merge(key, null)` is the ONLY reliable cold-launch reset.
    // `initialKeyStates: null` and `Onyx.set(key, null)` both no-op against a
    // persisted value (see OnyxColdLaunchReset.test.ts), so the action must use
    // merge — and must use it for BOTH the last-viewed map and the months-loaded
    // counter, or the calendar reopens on a stale month after a relaunch.
    Calendar.resetCalendarStateForColdLaunch();

    expect(mockedSet).not.toHaveBeenCalled();
    expect(mockedMerge).toHaveBeenCalledTimes(2);
    expect(mockedMerge).toHaveBeenCalledWith(
      ONYXKEYS.NVP_LAST_VIEWED_CALENDAR_DATE,
      null,
    );
    expect(mockedMerge).toHaveBeenCalledWith(
      ONYXKEYS.SESSIONS_CALENDAR_MONTHS_LOADED,
      null,
    );
  });
});

describe('setSessionsCalendarMonthsLoadedForUser', () => {
  it('merges the months-loaded depth into that user’s own collection key', () => {
    Calendar.setSessionsCalendarMonthsLoadedForUser('user-7', 5);

    expect(mockedMerge).toHaveBeenCalledTimes(1);
    expect(mockedMerge).toHaveBeenCalledWith(
      `${ONYXKEYS.COLLECTION.SESSIONS_CALENDAR_MONTHS_BY_USER_ID}user-7`,
      5,
    );
  });

  it('writes each user under a distinct, per-user collection key', () => {
    Calendar.setSessionsCalendarMonthsLoadedForUser('user-a', 2);
    Calendar.setSessionsCalendarMonthsLoadedForUser('user-b', 9);

    const keysWritten = mockedMerge.mock.calls.map(call => call[0]);
    expect(keysWritten).toEqual([
      `${ONYXKEYS.COLLECTION.SESSIONS_CALENDAR_MONTHS_BY_USER_ID}user-a`,
      `${ONYXKEYS.COLLECTION.SESSIONS_CALENDAR_MONTHS_BY_USER_ID}user-b`,
    ]);
  });
});
