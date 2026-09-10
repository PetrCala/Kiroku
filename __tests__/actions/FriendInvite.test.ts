/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/no-api-in-views, rulesdir/prefer-actions-set-data -- this test mocks the API and Onyx modules the action under test calls */
import Onyx from 'react-native-onyx';
import * as API from '@libs/API';
import {getKirokuRoute} from '@libs/API/kirokuRoutes';
import {SIDE_EFFECT_REQUEST_COMMANDS} from '@libs/API/types';
import HttpsError from '@libs/Errors/HttpsError';
import * as FriendInvite from '@userActions/FriendInvite';
import ONYXKEYS from '@src/ONYXKEYS';

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

jest.mock('@libs/Firebase/FirebaseApp', () => ({
  getFirebaseAuth: () => ({currentUser: {uid: 'user-1'}}),
}));

jest.mock('@libs/API', () => ({makeRequestWithSideEffects: jest.fn()}));

const mockedRequest = jest.mocked(API.makeRequestWithSideEffects);
const mockedOnyxUpdate = jest.mocked(Onyx.update);
const mockedOnyxSet = jest.mocked(Onyx.set);

const OWNER = 'owner-1';
const CODE = 'abcd234567';

function friendEdge(value: true | null) {
  return {
    onyxMethod: 'merge',
    key: ONYXKEYS.USER_DATA_LIST,
    value: {'user-1': {friends: {[OWNER]: value}}},
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchInviteCode / resetInviteCode', () => {
  it('fetches the own code through the GET invite route', async () => {
    mockedRequest.mockResolvedValueOnce({jsonCode: 200, onyxData: []});
    await FriendInvite.fetchInviteCode();
    expect(mockedRequest).toHaveBeenCalledWith(
      SIDE_EFFECT_REQUEST_COMMANDS.GET_INVITE_CODE,
      {},
    );
  });

  it('rotates the code through the reset route and surfaces failures', async () => {
    mockedRequest.mockRejectedValueOnce(new Error('offline'));
    await expect(FriendInvite.resetInviteCode()).rejects.toThrow('offline');
    expect(mockedRequest).toHaveBeenCalledWith(
      SIDE_EFFECT_REQUEST_COMMANDS.RESET_INVITE_CODE,
      {},
    );
  });
});

describe('getInvitePreview', () => {
  it('returns the invitePreview sidecar', async () => {
    const invitePreview = {
      userID: OWNER,
      profile: {display_name: 'Bob', photo_url: ''},
    };
    mockedRequest.mockResolvedValueOnce({
      jsonCode: 200,
      onyxData: [],
      invitePreview,
    });
    await expect(FriendInvite.getInvitePreview(CODE)).resolves.toEqual(
      invitePreview,
    );
    expect(mockedRequest).toHaveBeenCalledWith(
      SIDE_EFFECT_REQUEST_COMMANDS.GET_INVITE_PREVIEW,
      {code: CODE},
    );
  });

  it('rejects when the response carries no preview', async () => {
    mockedRequest.mockResolvedValueOnce({jsonCode: 200, onyxData: []});
    await expect(FriendInvite.getInvitePreview(CODE)).rejects.toThrow();
  });

  it('passes the HTTP error through for the screen to classify', async () => {
    const notFound = new HttpsError({message: 'Not Found', status: '404'});
    mockedRequest.mockRejectedValueOnce(notFound);
    await expect(FriendInvite.getInvitePreview(CODE)).rejects.toBe(notFound);
  });
});

describe('redeemInvite', () => {
  it('adds the friend optimistically and resolves with the server friend ID', async () => {
    mockedRequest.mockResolvedValueOnce({
      jsonCode: 200,
      onyxData: [],
      friendUserID: OWNER,
    });
    await expect(FriendInvite.redeemInvite(CODE, OWNER)).resolves.toBe(OWNER);
    expect(mockedRequest).toHaveBeenCalledWith(
      SIDE_EFFECT_REQUEST_COMMANDS.REDEEM_INVITE,
      {code: CODE},
      {optimisticData: [friendEdge(true)]},
    );
    expect(mockedOnyxUpdate).not.toHaveBeenCalled();
  });

  it('rolls the optimistic friendship back when the server refuses', async () => {
    const blocked = new HttpsError({message: 'Forbidden', status: '403'});
    mockedRequest.mockRejectedValueOnce(blocked);
    await expect(FriendInvite.redeemInvite(CODE, OWNER)).rejects.toBe(blocked);
    expect(mockedOnyxUpdate).toHaveBeenCalledWith([friendEdge(null)]);
  });
});

describe('pending invite stash', () => {
  it('stores the code with a timestamp, and clears it', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    FriendInvite.stashPendingInvite(CODE);
    expect(mockedOnyxSet).toHaveBeenCalledWith(ONYXKEYS.PENDING_FRIEND_INVITE, {
      code: CODE,
      createdAt: 1_800_000_000_000,
    });
    FriendInvite.clearPendingInvite();
    expect(mockedOnyxSet).toHaveBeenLastCalledWith(
      ONYXKEYS.PENDING_FRIEND_INVITE,
      null,
    );
  });
});

describe('invite routes', () => {
  it('serves the preview without auth and encodes the code into the path', () => {
    const route = getKirokuRoute(
      SIDE_EFFECT_REQUEST_COMMANDS.GET_INVITE_PREVIEW,
    );
    expect(route?.requiresAuth).toBe(false);
    expect(route?.method).toBe('get');
    expect(route?.toPath?.({code: 'a/b'})).toBe('/v1/friends/invite/a%2Fb');
  });

  it('keeps fetch, reset and redeem authenticated', () => {
    const commands = [
      SIDE_EFFECT_REQUEST_COMMANDS.GET_INVITE_CODE,
      SIDE_EFFECT_REQUEST_COMMANDS.RESET_INVITE_CODE,
      SIDE_EFFECT_REQUEST_COMMANDS.REDEEM_INVITE,
    ];
    commands.forEach(command => {
      expect(getKirokuRoute(command)?.requiresAuth).toBeUndefined();
    });
    expect(
      getKirokuRoute(SIDE_EFFECT_REQUEST_COMMANDS.REDEEM_INVITE)?.toPath?.({
        code: CODE,
      }),
    ).toBe(`/v1/friends/invite/${CODE}/redeem`);
  });
});
