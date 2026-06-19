/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/prefer-actions-set-data -- this test references the mocked Onyx.merge/set to assert what the action issues; it is not app code */

/**
 * Write-level coverage of the per-user "last viewed calendar date" map (Calendar
 * Rule 2). `NVP_LAST_VIEWED_CALENDAR_DATE` is a `Record<UserID, DateString>`, and
 * its independence is structural: each action only ever touches `{[userID]: ...}`.
 * These tests lock that the actions MERGE a single user's slot (never SET the
 * whole map), and that clearing one user uses a nested null (delete one slot).
 * The end-to-end proof that those merges isolate users on real Onyx lives in
 * OnyxColdLaunchReset.test.ts.
 */

import ONYXKEYS from '@src/ONYXKEYS';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import * as App from '@userActions/App';
import Onyx from 'react-native-onyx';

const DATE_A = '2026-06-19' as DateString;

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

// App.ts registers a module-level AppState listener at import; stub react-native.
jest.mock('react-native', () => ({
  AppState: {addEventListener: jest.fn(), currentState: 'active'},
}));

// Heavy siblings App.ts imports that are irrelevant to the calendar-date actions.
jest.mock('@libs/API', () => ({
  write: jest.fn(),
  read: jest.fn(),
  makeRequestWithSideEffects: jest.fn(),
}));
jest.mock('@libs/Navigation/Navigation', () => ({
  __esModule: true,
  default: {navigate: jest.fn(), goBack: jest.fn()},
}));
jest.mock('@libs/Navigation/currentUrl', () => ({
  __esModule: true,
  default: jest.fn(() => ''),
}));
jest.mock('@libs/setCalendarLocale', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedMerge = jest.mocked(Onyx.merge);
const mockedSet = jest.mocked(Onyx.set);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('per-user last-viewed-date writes use merge, not set', () => {
  // The one invariant worth guarding at the action level: both actions reach the
  // map with a per-user MERGE (preserving other users' slots) and never a whole-
  // map SET (which would wipe them). That a write/clear actually isolates one
  // user's slot end-to-end is proven against real Onyx in OnyxColdLaunchReset.
  it('sets a slot via merge({uid: date}) and clears it via merge({uid: null})', () => {
    App.setLastViewedCalendarDate('user-1', DATE_A);
    App.clearLastViewedCalendarDate('user-1');

    expect(mockedSet).not.toHaveBeenCalled();
    expect(mockedMerge.mock.calls).toEqual([
      [ONYXKEYS.NVP_LAST_VIEWED_CALENDAR_DATE, {'user-1': DATE_A}],
      [ONYXKEYS.NVP_LAST_VIEWED_CALENDAR_DATE, {'user-1': null}],
    ]);
  });
});
