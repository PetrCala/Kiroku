/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/no-api-in-views -- this test asserts on the mocked API.write pipeline; it is not a view */

import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import ONYXKEYS from '@src/ONYXKEYS';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import * as UserData from '@userActions/UserData';

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

jest.mock('@libs/API', () => ({write: jest.fn()}));

jest.mock('@libs/Firebase/FirebaseApp', () => ({
  getFirebaseAuth: jest.fn(),
}));

const mockedWrite = API.write as jest.Mock;
const mockedGetAuth = getFirebaseAuth as unknown as jest.Mock;

describe('UserData timezone actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAuth.mockReturnValue({currentUser: {uid: 'uid-A'}});
  });

  describe('updateAutomaticTimezone', () => {
    it('writes the timezone via UPDATE_AUTOMATIC_TIMEZONE with an optimistic merge onto USER_DATA_LIST', () => {
      UserData.updateAutomaticTimezone({
        automatic: true,
        selected: 'Europe/Prague',
      });

      expect(mockedWrite).toHaveBeenCalledTimes(1);
      const [command, params, options] = mockedWrite.mock.calls[0];
      expect(command).toBe(WRITE_COMMANDS.UPDATE_AUTOMATIC_TIMEZONE);
      expect(params).toEqual({
        timezone: {automatic: true, selected: 'Europe/Prague'},
      });
      expect(options.optimisticData).toEqual([
        {
          onyxMethod: 'merge',
          key: ONYXKEYS.USER_DATA_LIST,
          value: {
            'uid-A': {timezone: {automatic: true, selected: 'Europe/Prague'}},
          },
        },
      ]);
    });

    it('normalizes a deprecated IANA name before persisting (params + optimistic data)', () => {
      UserData.updateAutomaticTimezone({
        automatic: true,
        selected: 'Asia/Calcutta' as SelectedTimezone,
      });

      const [, params, options] = mockedWrite.mock.calls[0];
      expect(params.timezone.selected).toBe('Asia/Kolkata');
      expect(options.optimisticData[0].value['uid-A'].timezone.selected).toBe(
        'Asia/Kolkata',
      );
    });

    it('no-ops when there is no authenticated user', () => {
      mockedGetAuth.mockReturnValue({currentUser: null});

      UserData.updateAutomaticTimezone({
        automatic: true,
        selected: 'Europe/Prague',
      });

      expect(mockedWrite).not.toHaveBeenCalled();
    });
  });

  describe('saveSelectedTimezone', () => {
    it('persists the selected zone with automatic turned off via UPDATE_SELECTED_TIMEZONE', () => {
      UserData.saveSelectedTimezone('Europe/Prague');

      expect(mockedWrite).toHaveBeenCalledTimes(1);
      const [command, params, options] = mockedWrite.mock.calls[0];
      expect(command).toBe(WRITE_COMMANDS.UPDATE_SELECTED_TIMEZONE);
      expect(params).toEqual({
        timezone: {selected: 'Europe/Prague', automatic: false},
      });
      expect(options.optimisticData[0].value['uid-A'].timezone).toEqual({
        selected: 'Europe/Prague',
        automatic: false,
      });
    });

    it('normalizes a deprecated selected zone before persisting', () => {
      UserData.saveSelectedTimezone('US/Pacific' as SelectedTimezone);

      const [, params] = mockedWrite.mock.calls[0];
      expect(params.timezone.selected).toBe('America/Los_Angeles');
      expect(params.timezone.automatic).toBe(false);
    });
  });
});
