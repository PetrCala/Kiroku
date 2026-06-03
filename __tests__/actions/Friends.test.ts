/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable @typescript-eslint/unbound-method -- references to mocked methods are read-only assertions, not actual call sites */
/* eslint-disable rulesdir/no-api-in-views -- this is a test that asserts on the mocked API.write, not a view */
/* eslint-disable rulesdir/prefer-actions-set-data -- this is a test that asserts on the mocked Onyx.merge, not app code */

import Onyx from 'react-native-onyx';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import * as Friends from '@userActions/Friends';
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
const {ADD, UPDATE, DELETE} = CONST.RED_BRICK_ROAD_PENDING_ACTION;

const mockedWrite = jest.mocked(API.write);
const mockedMerge = jest.mocked(Onyx.merge);

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

describe('Friends actions — offline feedback (pattern B)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sendFriendRequest: additive ADD that survives failure', () => {
    Friends.sendFriendRequest(OTHER);
    const {command, params, onyxData} = lastWrite();

    expect(command).toBe(WRITE_COMMANDS.SEND_FRIEND_REQUEST);
    expect(params).toEqual({toUserId: OTHER});
    expect(onyxData?.optimisticData).toEqual([
      userDataPatch(ME, {
        friend_requests: {[OTHER]: CONST.FRIEND_REQUEST_STATUS.SENT},
      }),
      metaPatch(OTHER, {pendingAction: ADD, errors: null}),
    ]);
    expect(onyxData?.successData).toEqual([metaPatch(OTHER, null)]);
    // Failure keeps the optimistic SENT row and only marks it errored.
    expect(onyxData?.failureData).toEqual([
      metaPatch(OTHER, {
        errors: {[ERROR_KEY]: 'friendAction.error.couldNotSendRequest'},
      }),
    ]);
  });

  it('acceptFriendRequest: keep-and-dim, applies the move on success only', () => {
    Friends.acceptFriendRequest(OTHER);
    const {command, onyxData} = lastWrite();

    expect(command).toBe(WRITE_COMMANDS.ACCEPT_FRIEND_REQUEST);
    // Optimistic only marks pending — the request is NOT moved yet.
    expect(onyxData?.optimisticData).toEqual([
      metaPatch(OTHER, {pendingAction: UPDATE, errors: null}),
    ]);
    expect(onyxData?.successData).toEqual([
      userDataPatch(ME, {
        friend_requests: {[OTHER]: null},
        friends: {[OTHER]: true},
      }),
      metaPatch(OTHER, null),
    ]);
    expect(onyxData?.failureData).toEqual([
      metaPatch(OTHER, {
        errors: {[ERROR_KEY]: 'friendAction.error.couldNotAcceptRequest'},
      }),
    ]);
  });

  it('deleteFriendRequest: keep-and-dim DELETE, removes on success only', () => {
    Friends.deleteFriendRequest(OTHER);
    const {command, onyxData} = lastWrite();

    expect(command).toBe(WRITE_COMMANDS.DELETE_FRIEND_REQUEST);
    expect(onyxData?.optimisticData).toEqual([
      metaPatch(OTHER, {pendingAction: DELETE, errors: null}),
    ]);
    expect(onyxData?.successData).toEqual([
      userDataPatch(ME, {friend_requests: {[OTHER]: null}}),
      metaPatch(OTHER, null),
    ]);
    expect(onyxData?.failureData).toEqual([
      metaPatch(OTHER, {
        errors: {[ERROR_KEY]: 'friendAction.error.couldNotRemoveRequest'},
      }),
    ]);
  });

  it('unfriend: keep-and-dim DELETE, removes the friend on success only', () => {
    Friends.unfriend(OTHER);
    const {command, onyxData} = lastWrite();

    expect(command).toBe(WRITE_COMMANDS.UNFRIEND);
    expect(onyxData?.optimisticData).toEqual([
      metaPatch(OTHER, {pendingAction: DELETE, errors: null}),
    ]);
    expect(onyxData?.successData).toEqual([
      userDataPatch(ME, {friends: {[OTHER]: null}}),
      metaPatch(OTHER, null),
    ]);
    expect(onyxData?.failureData).toEqual([
      metaPatch(OTHER, {
        errors: {[ERROR_KEY]: 'friendAction.error.couldNotUnfriend'},
      }),
    ]);
  });

  it('clearFriendActionError(ADD): rolls back the optimistic request + clears metadata', () => {
    Friends.clearFriendActionError(OTHER, ADD);

    expect(mockedMerge).toHaveBeenCalledWith(ONYXKEYS.USER_DATA_LIST, {
      [ME]: {friend_requests: {[OTHER]: null}},
    });
    expect(mockedMerge).toHaveBeenCalledWith(ONYXKEYS.FRIENDS_METADATA, {
      [OTHER]: null,
    });
  });

  it('clearFriendActionError(DELETE): clears only metadata, no rollback', () => {
    Friends.clearFriendActionError(OTHER, DELETE);

    expect(mockedMerge).toHaveBeenCalledTimes(1);
    expect(mockedMerge).toHaveBeenCalledWith(ONYXKEYS.FRIENDS_METADATA, {
      [OTHER]: null,
    });
  });
});
