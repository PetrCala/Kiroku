/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/prefer-actions-set-data -- this test seeds the measured offset directly, the way HttpUtils stores it */

/**
 * `DateUtils.getServerTime` is the device clock corrected by the measured
 * offset (`NETWORK.timeSkew`), in both directions. Runs against real Onyx.
 */
import Onyx from 'react-native-onyx';
import DateUtils from '@libs/DateUtils';
import ONYXKEYS from '@src/ONYXKEYS';

// Onyx batches updates through react-dom's unstable_batchedUpdates, which is
// undefined in this RN test environment; run the callback synchronously.
jest.mock('react-native-onyx/dist/batch', () => ({
  __esModule: true,
  default: (callback: () => void) => callback(),
}));

const NOW = 1_700_000_000_000;

async function setTimeSkew(timeSkew: number | null): Promise<void> {
  await Onyx.merge(ONYXKEYS.NETWORK, {timeSkew});
  await new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });
}

function serverTimeAt(now: number): number {
  const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
  try {
    return DateUtils.getServerTime();
  } finally {
    spy.mockRestore();
  }
}

beforeAll(() => {
  Onyx.init({keys: ONYXKEYS});
});

beforeEach(async () => {
  await Onyx.clear();
  await setTimeSkew(null);
});

describe('DateUtils.getServerTime', () => {
  it('is the device clock before any measurement', () => {
    expect(serverTimeAt(NOW)).toBe(NOW);
  });

  it('adds the offset when the device clock is behind the server', async () => {
    await setTimeSkew(60_000);
    expect(serverTimeAt(NOW)).toBe(NOW + 60_000);
  });

  it('subtracts it when the device clock is ahead', async () => {
    await setTimeSkew(-5_000);
    expect(serverTimeAt(NOW)).toBe(NOW - 5_000);
  });
});
