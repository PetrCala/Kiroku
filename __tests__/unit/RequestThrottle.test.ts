/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
import RequestThrottle from '@libs/RequestThrottle';
import type {RequestError} from '@libs/Network/SequentialQueue';
import CONST from '@src/CONST';

// RequestThrottle logs through @libs/Log, which touches Onyx; Onyx batches
// updates through react-dom's unstable_batchedUpdates, undefined in this RN
// test environment. Run the callback synchronously instead.
jest.mock('react-native-onyx/dist/batch', () => ({
  __esModule: true,
  default: (callback: () => void) => callback(),
}));

// Shrink the budget and waits so the test runs in milliseconds.
type MutableNetworkTuning = {
  MAX_REQUEST_RETRIES: number;
  MIN_RETRY_WAIT_TIME_MS: number;
  MAX_RANDOM_RETRY_WAIT_TIME_MS: number;
  MAX_RETRY_WAIT_TIME_MS: number;
};
const networkTuning = CONST.NETWORK as unknown as MutableNetworkTuning;
const originalTuning: MutableNetworkTuning = {
  MAX_REQUEST_RETRIES: networkTuning.MAX_REQUEST_RETRIES,
  MIN_RETRY_WAIT_TIME_MS: networkTuning.MIN_RETRY_WAIT_TIME_MS,
  MAX_RANDOM_RETRY_WAIT_TIME_MS: networkTuning.MAX_RANDOM_RETRY_WAIT_TIME_MS,
  MAX_RETRY_WAIT_TIME_MS: networkTuning.MAX_RETRY_WAIT_TIME_MS,
};

beforeAll(() => {
  networkTuning.MAX_REQUEST_RETRIES = 2;
  networkTuning.MIN_RETRY_WAIT_TIME_MS = 1;
  networkTuning.MAX_RANDOM_RETRY_WAIT_TIME_MS = 2;
  networkTuning.MAX_RETRY_WAIT_TIME_MS = 4;
});

afterAll(() => {
  Object.assign(networkTuning, originalTuning);
});

describe('RequestThrottle', () => {
  const error: RequestError = new Error('Failed to fetch');

  it('rejects once the retry budget is exhausted', async () => {
    const throttle = new RequestThrottle('test');
    await throttle.sleep(error, 'Cmd');
    await throttle.sleep(error, 'Cmd');
    await expect(throttle.sleep(error, 'Cmd')).rejects.toBeUndefined();
  });

  it('resetBudget grants a fresh consecutive-failure budget', async () => {
    const throttle = new RequestThrottle('test');
    await throttle.sleep(error, 'Cmd');
    await throttle.sleep(error, 'Cmd');
    // Simulates a reconnection: the next online window starts from zero
    // instead of inheriting failures burned in earlier windows.
    throttle.resetBudget();
    await throttle.sleep(error, 'Cmd');
    await throttle.sleep(error, 'Cmd');
    await expect(throttle.sleep(error, 'Cmd')).rejects.toBeUndefined();
  });
});
