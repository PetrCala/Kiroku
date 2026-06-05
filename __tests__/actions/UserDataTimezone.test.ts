/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/no-api-in-views -- this test asserts on the mocked API.write pipeline; it is not a view */

import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import ONYXKEYS from '@src/ONYXKEYS';
import type {SelectedTimezone, Timezone} from '@src/types/onyx/UserData';
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

/** The optimistic Onyx update the action attaches for the current user. */
function expectedOptimisticData(timezone: Timezone) {
  return [
    {
      onyxMethod: 'merge',
      key: ONYXKEYS.USER_DATA_LIST,
      value: {'uid-A': {timezone}},
    },
  ];
}

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

      const timezone: Timezone = {automatic: true, selected: 'Europe/Prague'};
      expect(mockedWrite).toHaveBeenCalledTimes(1);
      expect(mockedWrite).toHaveBeenCalledWith(
        WRITE_COMMANDS.UPDATE_AUTOMATIC_TIMEZONE,
        {timezone},
        {optimisticData: expectedOptimisticData(timezone)},
      );
    });

    it('normalizes a deprecated IANA name before persisting (params + optimistic data)', () => {
      UserData.updateAutomaticTimezone({
        automatic: true,
        selected: 'Asia/Calcutta' as SelectedTimezone,
      });

      const timezone: Timezone = {automatic: true, selected: 'Asia/Kolkata'};
      expect(mockedWrite).toHaveBeenCalledWith(
        WRITE_COMMANDS.UPDATE_AUTOMATIC_TIMEZONE,
        {timezone},
        {optimisticData: expectedOptimisticData(timezone)},
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

      const timezone: Timezone = {selected: 'Europe/Prague', automatic: false};
      expect(mockedWrite).toHaveBeenCalledTimes(1);
      expect(mockedWrite).toHaveBeenCalledWith(
        WRITE_COMMANDS.UPDATE_SELECTED_TIMEZONE,
        {timezone},
        {optimisticData: expectedOptimisticData(timezone)},
      );
    });

    it('normalizes a deprecated selected zone before persisting', () => {
      UserData.saveSelectedTimezone('US/Pacific' as SelectedTimezone);

      const timezone: Timezone = {
        selected: 'America/Los_Angeles',
        automatic: false,
      };
      expect(mockedWrite).toHaveBeenCalledWith(
        WRITE_COMMANDS.UPDATE_SELECTED_TIMEZONE,
        {timezone},
        {optimisticData: expectedOptimisticData(timezone)},
      );
    });
  });
});
