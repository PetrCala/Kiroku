/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable @typescript-eslint/unbound-method -- references to mocked methods are read-only assertions, not actual call sites */
/* eslint-disable rulesdir/no-api-in-views -- this is a test that asserts on the mocked API.write, not a view */
/* eslint-disable rulesdir/prefer-actions-set-data -- this is a test that asserts on the mocked Onyx.merge, not app code */

import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import * as Block from '@userActions/Block';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

// Stub Onyx so importing the action under test doesn't start real Onyx.connect
// timers, which otherwise fire after the jest environment is torn down.
jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    update: jest.fn(() => Promise.resolve()),
    merge: jest.fn(() => Promise.resolve()),
    set: jest.fn(() => Promise.resolve()),
    METHOD: {MERGE: 'merge', SET: 'set'},
  },
  useOnyx: jest.fn(),
}));

// jest.mock factories are hoisted above the const declarations below, so they
// must inline literals rather than reference out-of-scope variables.
jest.mock('@libs/Firebase/FirebaseApp', () => ({
  getFirebaseAuth: () => ({currentUser: {uid: 'user-1'}}),
}));

jest.mock('@libs/API', () => ({write: jest.fn()}));

// Isolate the action's Onyx-shaping from the Localize/Onyx-backed error builder.
jest.mock('@libs/ErrorUtils', () => ({
  getMicroSecondOnyxErrorWithTranslationKey: (key: string) => ({
    '1700000000000000': key,
  }),
}));

const ME = 'user-1';
const OTHER = 'friend-2';
const ERROR_KEY = '1700000000000000';
const {DELETE} = CONST.RED_BRICK_ROAD_PENDING_ACTION;

const mockedWrite = jest.mocked(API.write);

function lastWrite() {
  const call = mockedWrite.mock.calls.at(-1);
  return {command: call?.[0], params: call?.[1], onyxData: call?.[2]};
}

const metaPatch = (uid: string, value: unknown) => ({
  onyxMethod: 'merge',
  key: ONYXKEYS.FRIENDS_METADATA,
  value: {[uid]: value},
});

const userDataPatch = (uid: string, value: unknown) => ({
  onyxMethod: 'merge',
  key: ONYXKEYS.USER_DATA_LIST,
  value: {[uid]: value},
});

describe('Block actions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('blockUser: keep-and-dim DELETE, removes friend + pending request on success only', () => {
    Block.blockUser(OTHER);
    const {command, params, onyxData} = lastWrite();

    expect(command).toBe(WRITE_COMMANDS.BLOCK_USER);
    expect(params).toEqual({otherUserId: OTHER});
    // Optimistic only marks pending — the friend is NOT dropped yet.
    expect(onyxData?.optimisticData).toEqual([
      metaPatch(OTHER, {pendingAction: DELETE, errors: null}),
    ]);
    // Block implies unfriend: drop the friend and clear any pending request
    // between the two on the caller's own record once the server confirms.
    expect(onyxData?.successData).toEqual([
      userDataPatch(ME, {
        friends: {[OTHER]: null},
        friend_requests: {[OTHER]: null},
      }),
      metaPatch(OTHER, null),
    ]);
    // Failure keeps the row and only marks it errored.
    expect(onyxData?.failureData).toEqual([
      metaPatch(OTHER, {
        errors: {[ERROR_KEY]: 'friendAction.error.couldNotBlockUser'},
      }),
    ]);
  });

  it('unblockUser: fire-and-forget command with no optimistic Onyx data', () => {
    Block.unblockUser(OTHER);
    const {command, params, onyxData} = lastWrite();

    expect(command).toBe(WRITE_COMMANDS.UNBLOCK_USER);
    expect(params).toEqual({otherUserId: OTHER});
    // Unblock does not re-friend, and the blocked list is server-hydrated.
    expect(onyxData).toBeUndefined();
  });
});
