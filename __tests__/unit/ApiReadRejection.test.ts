/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable @typescript-eslint/unbound-method -- references to mocked methods are read-only assertions, not actual call sites */
/* eslint-disable rulesdir/no-api-side-effects-method -- this test exercises makeRequestWithSideEffects directly */
/* eslint-disable rulesdir/no-api-in-views -- this test drives the mocked API layer directly, it is not a view */
/* eslint-disable rulesdir/no-multiple-api-calls -- each test case intentionally issues its own isolated API call */

import * as API from '@libs/API';
import {READ_COMMANDS, SIDE_EFFECT_REQUEST_COMMANDS} from '@libs/API/types';
import HttpsError from '@libs/Errors/HttpsError';
import Log from '@libs/Log';
import * as SequentialQueue from '@libs/Network/SequentialQueue';
import * as Request from '@libs/Request';
import CONST from '@src/CONST';

// Stub Onyx so importing @libs/API doesn't start real Onyx.connect timers, which
// otherwise fire after the jest environment is torn down.
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

// The middleware values are only forwarded to the mocked `Request.use`, so their
// shape is irrelevant — stub them to keep the heavy real middleware out of the run.
jest.mock('@libs/Middleware', () => ({
  Logging: 'Logging',
  RecheckConnection: 'RecheckConnection',
  Reauthentication: 'Reauthentication',
  SaveResponseInOnyx: 'SaveResponseInOnyx',
}));

// `Request.processWithMiddleware` is the seam we drive: it resolves/rejects to
// simulate the HTTP layer (`HttpUtils` rejects with an `HttpsError` on a non-2xx).
jest.mock('@libs/Request', () => ({
  use: jest.fn(),
  processWithMiddleware: jest.fn(),
}));

jest.mock('@libs/Network/SequentialQueue', () => ({
  waitForIdle: jest.fn(() => Promise.resolve()),
  push: jest.fn(() => Promise.resolve()),
}));

jest.mock('@libs/Network/NetworkStore', () => ({
  isOffline: jest.fn(() => false),
}));

jest.mock('@libs/Pusher/pusher', () => ({
  getPusherSocketID: jest.fn(() => undefined),
}));

jest.mock('@userActions/PersistedRequests', () => ({
  getAll: jest.fn(() => []),
}));

const mockedProcess = jest.mocked(Request.processWithMiddleware);
const mockedWaitForIdle = jest.mocked(SequentialQueue.waitForIdle);
const mockedLogInfo = jest.mocked(Log.info);

const SWALLOW_MESSAGE = '[API] Swallowed rejected read request';

/** Flush the microtask queue so fire-and-forget read chains settle. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- intentional sequential microtask flush
    await Promise.resolve();
  }
}

describe('API read-path rejection handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedWaitForIdle.mockReturnValue(Promise.resolve());
  });

  it('makeRequestWithSideEffects RESOLVES (never rejects) when a READ-type request fails with a non-2xx', async () => {
    mockedProcess.mockImplementation(() =>
      Promise.reject(new HttpsError({message: 'Unauthorized', status: '401'})),
    );

    // Without the read-path catch this would reject and escape as an unhandled
    // promise rejection (the web dev-server red overlay seen during #781 QA).
    await expect(
      API.makeRequestWithSideEffects(
        READ_COMMANDS.OPEN_FRIEND_LIST,
        {userID: 'user-1'},
        {},
        CONST.API_REQUEST_TYPE.READ,
      ),
    ).resolves.toBeUndefined();

    // Swallowed, but still traced (the Logging middleware logged the details;
    // this is the "handled, not silent" marker).
    expect(mockedLogInfo).toHaveBeenCalledWith(
      SWALLOW_MESSAGE,
      false,
      expect.objectContaining({command: READ_COMMANDS.OPEN_FRIEND_LIST}),
    );
  });

  it('makeRequestWithSideEffects still REJECTS a non-READ (true side-effect) request so callers can handle errors', async () => {
    const error = new HttpsError({message: 'Unauthorized', status: '401'});
    mockedProcess.mockImplementation(() => Promise.reject(error));

    await expect(
      API.makeRequestWithSideEffects(
        SIDE_EFFECT_REQUEST_COMMANDS.GET_BUG_LIST,
        {},
      ),
    ).rejects.toBe(error);

    expect(mockedLogInfo).not.toHaveBeenCalledWith(
      SWALLOW_MESSAGE,
      false,
      expect.anything(),
    );
  });

  it('makeRequestWithSideEffects passes a successful READ response through untouched', async () => {
    const response = {jsonCode: 200, onyxData: []};
    mockedProcess.mockImplementation(() => Promise.resolve(response as never));

    await expect(
      API.makeRequestWithSideEffects(
        READ_COMMANDS.OPEN_FRIEND_LIST,
        {userID: 'user-1'},
        {},
        CONST.API_REQUEST_TYPE.READ,
      ),
    ).resolves.toBe(response);

    expect(mockedLogInfo).not.toHaveBeenCalledWith(
      SWALLOW_MESSAGE,
      false,
      expect.anything(),
    );
  });

  it('read() swallows a failed read instead of surfacing an unhandled rejection', async () => {
    mockedProcess.mockImplementation(() =>
      Promise.reject(
        new HttpsError({message: 'Internal Server Error', status: '500'}),
      ),
    );

    expect(() =>
      API.read(READ_COMMANDS.OPEN_FRIEND_LIST, {userID: 'user-1'}),
    ).not.toThrow();

    await flushMicrotasks();

    expect(mockedLogInfo).toHaveBeenCalledWith(
      SWALLOW_MESSAGE,
      false,
      expect.objectContaining({command: READ_COMMANDS.OPEN_FRIEND_LIST}),
    );
  });
});
