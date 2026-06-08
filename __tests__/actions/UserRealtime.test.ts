/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable @typescript-eslint/unbound-method -- references to mocked methods are read-only assertions, not actual call sites */

import * as OnyxUpdates from '@userActions/OnyxUpdates';
import PusherUtils from '@libs/PusherUtils';
import * as UserActions from '@userActions/User';
import CONST from '@src/CONST';

// Stub Onyx so importing User.ts doesn't start real Onyx.connect timers, which
// otherwise fire after the jest environment is torn down and crash the run.
jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    update: jest.fn(() => Promise.resolve()),
    merge: jest.fn(() => Promise.resolve()),
    set: jest.fn(() => Promise.resolve()),
  },
  useOnyx: jest.fn(),
}));

jest.mock('@libs/Firebase/FirebaseApp', () => ({
  getFirebaseAuth: () => ({currentUser: {uid: 'user-1'}}),
}));

// User.ts pulls native-only modules (apple-auth via OAuthCredential) that jest
// can't transform; stub them out so importing the action under test doesn't load
// them.
jest.mock('@libs/OAuthCredential', () => ({getOAuthCredential: jest.fn()}));
jest.mock('@userActions/Session', () => ({}));

// Log schedules a periodic flush timer at import that fires after teardown.
jest.mock('@libs/Log', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    alert: jest.fn(),
    hmmm: jest.fn(),
  },
}));

jest.mock('@libs/Pusher/pusher', () => ({
  TYPE: {
    ONYX_API_UPDATE: 'onyxApiUpdate',
    MULTIPLE_EVENT_TYPE: {ONYX_API_UPDATE: 'onyxApiUpdate'},
  },
}));

jest.mock('@libs/PusherUtils', () => ({
  __esModule: true,
  default: {
    subscribeToMultiEvent: jest.fn(),
    subscribeToPrivateUserChannelEvent: jest.fn(),
  },
}));

jest.mock('@userActions/OnyxUpdates', () => ({
  apply: jest.fn(),
  saveUpdateInformation: jest.fn(),
  doesClientNeedToBeUpdated: jest.fn(),
}));

const mockedSubscribe = jest.mocked(
  PusherUtils.subscribeToPrivateUserChannelEvent,
);
const mockedApply = jest.mocked(OnyxUpdates.apply);
const mockedSave = jest.mocked(OnyxUpdates.saveUpdateInformation);
const mockedNeedsUpdate = jest.mocked(OnyxUpdates.doesClientNeedToBeUpdated);

type PushCallback = (pushJSON: Record<string, unknown>) => void;

/** Subscribe, then return the callback registered for the onyxApiUpdate event. */
function getPushCallback(): PushCallback {
  UserActions.subscribeToUserEvents();
  const call = mockedSubscribe.mock.calls.at(-1);
  return call?.[2] as PushCallback;
}

const pushEvent = {
  eventType: 'onyxApiUpdate',
  data: [{onyxMethod: 'merge', key: 'userDataList', value: {}}],
  lastUpdateID: 5,
  previousUpdateID: 4,
};

describe('subscribeToUserEvents pushed-update routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies the update directly when there is no gap', () => {
    mockedNeedsUpdate.mockReturnValue(false);

    getPushCallback()(pushEvent);

    expect(mockedNeedsUpdate).toHaveBeenCalledWith(4);
    expect(mockedApply).toHaveBeenCalledTimes(1);
    expect(mockedApply).toHaveBeenCalledWith({
      type: CONST.ONYX_UPDATE_TYPES.PUSHER,
      lastUpdateID: 5,
      previousUpdateID: 4,
      updates: [{eventType: 'onyxApiUpdate', data: pushEvent.data}],
    });
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it('defers to backfill when the client is behind (gap detected)', () => {
    mockedNeedsUpdate.mockReturnValue(true);

    getPushCallback()(pushEvent);

    expect(mockedNeedsUpdate).toHaveBeenCalledWith(4);
    expect(mockedSave).toHaveBeenCalledTimes(1);
    expect(mockedSave).toHaveBeenCalledWith({
      type: CONST.ONYX_UPDATE_TYPES.PUSHER,
      lastUpdateID: 5,
      previousUpdateID: 4,
      updates: [{eventType: 'onyxApiUpdate', data: pushEvent.data}],
    });
    expect(mockedApply).not.toHaveBeenCalled();
  });
});
