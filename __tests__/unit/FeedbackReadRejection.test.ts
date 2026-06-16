/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable @typescript-eslint/unbound-method -- references to mocked methods are read-only assertions, not actual call sites */
/* eslint-disable rulesdir/prefer-actions-set-data -- this test asserts on the mocked Onyx.set, not app code */

import Onyx from 'react-native-onyx';
import {getBugList, getFeedbackList} from '@libs/actions/Feedback';
import HttpsError from '@libs/Errors/HttpsError';
import Log from '@libs/Log';
import * as Request from '@libs/Request';
import ONYXKEYS from '@src/ONYXKEYS';

// Stub Onyx so importing the action (via @libs/API) doesn't start real
// Onyx.connect timers, and so we can assert whether the list key was written.
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
const mockedSet = jest.mocked(Onyx.set);
const mockedLogWarn = jest.mocked(Log.warn);

describe('Feedback admin read rejection handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFeedbackList', () => {
    it('RESOLVES (never rejects) and leaves FEEDBACK_LIST untouched when the read fails with a non-2xx', async () => {
      const error = new HttpsError({message: 'Unauthorized', status: '401'});
      mockedProcess.mockImplementation(() => Promise.reject(error));

      // Without the action-level catch this would reject and escape as an
      // unhandled rejection (the screen calls it with `.finally`, no `.catch`).
      await expect(getFeedbackList()).resolves.toBeUndefined();

      // The cached list must survive a transient failure, never clobbered with {}.
      expect(mockedSet).not.toHaveBeenCalled();
      expect(mockedLogWarn).toHaveBeenCalledWith(
        '[Feedback] getFeedbackList failed',
        {error},
      );
    });

    it('writes the fetched list to FEEDBACK_LIST on a successful response', async () => {
      const list = {abc: {user_id: 'user-1', text: 'hi', submit_time: 1}};
      mockedProcess.mockImplementation(() => Promise.resolve(list as never));

      await expect(getFeedbackList()).resolves.toBeUndefined();

      expect(mockedSet).toHaveBeenCalledWith(ONYXKEYS.FEEDBACK_LIST, list);
      expect(mockedLogWarn).not.toHaveBeenCalled();
    });
  });

  describe('getBugList', () => {
    it('RESOLVES (never rejects) and leaves BUG_LIST untouched when the read fails with a non-2xx', async () => {
      const error = new HttpsError({
        message: 'Internal Server Error',
        status: '500',
      });
      mockedProcess.mockImplementation(() => Promise.reject(error));

      await expect(getBugList()).resolves.toBeUndefined();

      expect(mockedSet).not.toHaveBeenCalled();
      expect(mockedLogWarn).toHaveBeenCalledWith(
        '[Feedback] getBugList failed',
        {
          error,
        },
      );
    });

    it('writes the fetched list to BUG_LIST on a successful response', async () => {
      const list = {xyz: {user_id: 'user-2', text: 'broken', submit_time: 2}};
      mockedProcess.mockImplementation(() => Promise.resolve(list as never));

      await expect(getBugList()).resolves.toBeUndefined();

      expect(mockedSet).toHaveBeenCalledWith(ONYXKEYS.BUG_LIST, list);
      expect(mockedLogWarn).not.toHaveBeenCalled();
    });
  });
});
