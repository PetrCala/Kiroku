/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

import {act, renderHook} from '@testing-library/react-native';
import useCurrentUserData from '@hooks/useCurrentUserData';
import DateUtils from '@libs/DateUtils';
import * as UserData from '@userActions/UserData';
import useAutoUpdateTimezone from '@hooks/useAutoUpdateTimezone';
import type {Timezone} from '@src/types/onyx/UserData';

// The latest foreground callback registered by the hook, captured so a test can
// simulate the app returning to the foreground.
// eslint-disable-next-line no-var, vars-on-top, @typescript-eslint/init-declarations
var mockFocusCallback: (() => void) | undefined;

jest.mock('@hooks/useAppFocusEvent', () => ({
  __esModule: true,
  default: (callback: () => void) => {
    mockFocusCallback = callback;
  },
}));

jest.mock('@hooks/useCurrentUserData', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@userActions/UserData', () => ({
  updateAutomaticTimezone: jest.fn(),
  saveSelectedTimezone: jest.fn(),
}));

jest.mock('@libs/DateUtils', () => ({
  __esModule: true,
  default: {
    // Identity normalization keeps the comparison logic under test; the real
    // deprecated-name mapping is covered by the UserData action test.
    formatToSupportedTimezone: jest.fn((timezone: Timezone) => timezone),
    canUpdateTimezone: jest.fn(() => true),
    setTimezoneUpdated: jest.fn(),
  },
}));

const mockedUseCurrentUserData = jest.mocked(useCurrentUserData);
const mockedUpdate = jest.mocked(UserData.updateAutomaticTimezone);
const mockedCanUpdate = jest.mocked(DateUtils.canUpdateTimezone);

const originalDateTimeFormat = Intl.DateTimeFormat;

/**
 * Stand in for the device's engine. `resolvedOptions()` reports `timeZone`, and
 * a formatter can be built for a name only when the engine knows it: the hook
 * resolves through `@libs/TimezoneUtils`, which validates a resolved name by
 * constructing a formatter from it, so the stub has to answer both questions
 * the way a real engine does. `UTC` is always known because that is where the
 * resolver falls back to when the resolved name is rejected.
 */
function setDeviceTimezone(timeZone: string, isAcceptedByEngine = true): void {
  const knownNames = isAcceptedByEngine ? [timeZone, 'UTC'] : ['UTC'];
  Intl.DateTimeFormat = jest.fn(
    (_locales?: string | string[], options?: Intl.DateTimeFormatOptions) => {
      const requested = options?.timeZone;
      if (requested !== undefined && !knownNames.includes(requested)) {
        throw new RangeError('Invalid timeZoneName');
      }
      return {
        resolvedOptions: () => ({timeZone: requested ?? timeZone}),
        formatToParts: () => [],
      };
    },
  ) as unknown as typeof Intl.DateTimeFormat;
}

function setStoredTimezone(timezone?: Timezone, isLoaded = true): void {
  const currentUserData = isLoaded
    ? {userID: 'uid-A', ...(timezone ? {timezone} : {})}
    : {};
  mockedUseCurrentUserData.mockReturnValue(currentUserData);
}

describe('useAutoUpdateTimezone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusCallback = undefined;
    mockedCanUpdate.mockReturnValue(true);
  });

  afterEach(() => {
    Intl.DateTimeFormat = originalDateTimeFormat;
  });

  it('first-set: persists the device timezone as automatic when none is stored', () => {
    setDeviceTimezone('Europe/Prague');
    setStoredTimezone(undefined);

    renderHook(() => useAutoUpdateTimezone());

    expect(mockedUpdate).toHaveBeenCalledWith({
      automatic: true,
      selected: 'Europe/Prague',
    });
  });

  it('auto-updates at login when automatic and the device moved', () => {
    setDeviceTimezone('America/New_York');
    setStoredTimezone({automatic: true, selected: 'Europe/Prague'});

    renderHook(() => useAutoUpdateTimezone());

    expect(mockedUpdate).toHaveBeenCalledWith({
      automatic: true,
      selected: 'America/New_York',
    });
  });

  it('no-ops when the device timezone is unchanged', () => {
    setDeviceTimezone('Europe/Prague');
    setStoredTimezone({automatic: true, selected: 'Europe/Prague'});

    renderHook(() => useAutoUpdateTimezone());

    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('no-ops when automatic is off, even if the device moved', () => {
    setDeviceTimezone('America/New_York');
    setStoredTimezone({automatic: false, selected: 'Europe/Prague'});

    renderHook(() => useAutoUpdateTimezone());

    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('respects the throttle window when an automatic update is due', () => {
    setDeviceTimezone('America/New_York');
    setStoredTimezone({automatic: true, selected: 'Europe/Prague'});
    mockedCanUpdate.mockReturnValue(false);

    renderHook(() => useAutoUpdateTimezone());

    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('never persists a device timezone the engine will not accept back', () => {
    // Hermes/Apple can resolve a name (e.g. "GMT") that it then rejects as a
    // `timeZone` option. Storing it would hand every later formatter a value
    // that throws, so the validated fallback is what gets written.
    setDeviceTimezone('GMT', false);
    setStoredTimezone(undefined);

    renderHook(() => useAutoUpdateTimezone());

    expect(mockedUpdate).toHaveBeenCalledWith({
      automatic: true,
      selected: 'UTC',
    });
  });

  it('does nothing until user data has loaded', () => {
    setDeviceTimezone('America/New_York');
    setStoredTimezone(undefined, false);

    renderHook(() => useAutoUpdateTimezone());

    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('re-checks the timezone when the app returns to the foreground', () => {
    setDeviceTimezone('Europe/Prague');
    setStoredTimezone({automatic: true, selected: 'Europe/Prague'});

    renderHook(() => useAutoUpdateTimezone());
    expect(mockedUpdate).not.toHaveBeenCalled();

    // Device crosses a timezone while the app is warm, then is foregrounded.
    setDeviceTimezone('America/New_York');
    act(() => mockFocusCallback?.());

    expect(mockedUpdate).toHaveBeenCalledWith({
      automatic: true,
      selected: 'America/New_York',
    });
  });
});
