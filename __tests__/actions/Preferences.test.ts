/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/no-api-in-views -- this test asserts on the mocked API.write pipeline; it is not a view */

import * as API from '@libs/API';
import {READ_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
import Navigation from '@libs/Navigation/Navigation';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Preferences} from '@src/types/onyx';
import * as PreferencesActions from '@userActions/Preferences';

// `Onyx.METHOD` is the only Onyx surface the action reads (it tags the optimistic
// updates). Everything else about preferences flows through the mocked API layer.
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

jest.mock('@libs/API', () => ({
  write: jest.fn(),
  makeRequestWithSideEffects: jest.fn(() => Promise.resolve()),
}));

jest.mock('@libs/Navigation/Navigation', () => ({
  __esModule: true,
  default: {goBack: jest.fn()},
}));

const mockedWrite = jest.mocked(API.write);
const mockedSideEffects = jest.mocked(API.makeRequestWithSideEffects);
const mockedGoBack = jest.mocked(Navigation.goBack);

type OptimisticUpdate = {onyxMethod: string; key: string; value: unknown};

/** The `optimisticData` array attached to the (single) UPDATE_PREFERENCES write. */
function optimisticDataOf(): OptimisticUpdate[] {
  expect(mockedWrite).toHaveBeenCalledTimes(1);
  const call = mockedWrite.mock.calls[0];
  expect(call[0]).toBe(WRITE_COMMANDS.UPDATE_PREFERENCES);
  return (
    (call[2] as {optimisticData?: OptimisticUpdate[]}).optimisticData ?? []
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updatePreferences', () => {
  it('persists the partial patch via UPDATE_PREFERENCES with an optimistic merge onto PREFERENCES', () => {
    const updates: Partial<Preferences> = {first_day_of_week: 'Monday'};

    PreferencesActions.updatePreferences(updates);

    expect(mockedWrite).toHaveBeenCalledTimes(1);
    expect(mockedWrite).toHaveBeenCalledWith(
      WRITE_COMMANDS.UPDATE_PREFERENCES,
      updates,
      {
        optimisticData: [
          {
            onyxMethod: 'merge',
            key: ONYXKEYS.PREFERENCES,
            value: updates,
          },
        ],
      },
    );
  });

  it('echoes the optimistic patch verbatim so re-applying the server response is idempotent', () => {
    // The server applies `merge(PREFERENCES, patch)`; the optimistic update must
    // be the SAME merge of the SAME patch, so the inline/pushed response merging
    // the identical patch again is a no-op (replay-safe).
    const updates: Partial<Preferences> = {
      session_color_palette: {
        green: '#00ff00',
        yellow: '#ffff00',
        orange: '#ff8800',
        red: '#ff0000',
        black: '#000000',
      },
    };

    PreferencesActions.updatePreferences(updates);

    const optimistic = optimisticDataOf();
    const preferencesMerge = optimistic.find(
      update => update.key === ONYXKEYS.PREFERENCES,
    );
    expect(preferencesMerge?.onyxMethod).toBe('merge');
    // Value-equal AND only the changed fields — never a full-object set that
    // could clobber server fields the client hasn't loaded.
    expect(preferencesMerge?.value).toEqual(updates);
  });

  it('also mirrors theme into the dedicated PREFERRED_THEME key (set)', () => {
    PreferencesActions.updatePreferences({theme: CONST.THEME.DARK});

    expect(optimisticDataOf()).toEqual([
      {
        onyxMethod: 'merge',
        key: ONYXKEYS.PREFERENCES,
        value: {theme: CONST.THEME.DARK},
      },
      {
        onyxMethod: 'set',
        key: ONYXKEYS.PREFERRED_THEME,
        value: CONST.THEME.DARK,
      },
    ]);
  });

  it('also mirrors locale into the dedicated NVP_PREFERRED_LOCALE key (set)', () => {
    PreferencesActions.updatePreferences({locale: CONST.LOCALES.CS_CZ});

    expect(optimisticDataOf()).toEqual([
      {
        onyxMethod: 'merge',
        key: ONYXKEYS.PREFERENCES,
        value: {locale: CONST.LOCALES.CS_CZ},
      },
      {
        onyxMethod: 'set',
        key: ONYXKEYS.NVP_PREFERRED_LOCALE,
        value: CONST.LOCALES.CS_CZ,
      },
    ]);
  });

  it('mirrors both theme and locale when both change in one patch', () => {
    PreferencesActions.updatePreferences({
      theme: CONST.THEME.LIGHT,
      locale: CONST.LOCALES.EN,
    });

    const optimistic = optimisticDataOf();
    expect(optimistic).toHaveLength(3);
    expect(
      optimistic.some(
        update =>
          update.key === ONYXKEYS.PREFERRED_THEME &&
          update.onyxMethod === 'set',
      ),
    ).toBe(true);
    expect(
      optimistic.some(
        update =>
          update.key === ONYXKEYS.NVP_PREFERRED_LOCALE &&
          update.onyxMethod === 'set',
      ),
    ).toBe(true);
  });

  it('does not echo theme/locale keys when neither field is part of the patch', () => {
    PreferencesActions.updatePreferences({
      track_location_during_sessions: true,
    });

    const optimistic = optimisticDataOf();
    expect(optimistic).toHaveLength(1);
    expect(optimistic[0].key).toBe(ONYXKEYS.PREFERENCES);
  });
});

describe('updateTheme', () => {
  it('writes the theme and then navigates back', () => {
    PreferencesActions.updateTheme(CONST.THEME.DARK);

    expect(mockedWrite).toHaveBeenCalledTimes(1);
    expect(mockedWrite).toHaveBeenCalledWith(
      WRITE_COMMANDS.UPDATE_PREFERENCES,
      {theme: CONST.THEME.DARK},
      expect.objectContaining({
        optimisticData: expect.arrayContaining([
          {
            onyxMethod: 'set',
            key: ONYXKEYS.PREFERRED_THEME,
            value: CONST.THEME.DARK,
          },
        ]),
      }),
    );
    expect(mockedGoBack).toHaveBeenCalledTimes(1);
  });
});

describe('openFriendPreferences', () => {
  it('reads a friend’s preferences through the privacy-gated READ side-effect', () => {
    PreferencesActions.openFriendPreferences('friend-1');

    expect(mockedWrite).not.toHaveBeenCalled();
    expect(mockedSideEffects).toHaveBeenCalledTimes(1);
    expect(mockedSideEffects).toHaveBeenCalledWith(
      READ_COMMANDS.OPEN_FRIEND_PREFERENCES,
      {userID: 'friend-1'},
      {},
      CONST.API_REQUEST_TYPE.READ,
    );
  });
});
