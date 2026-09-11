/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

/**
 * A queued write must stay on disk while it is in flight, so a restart can
 * replay it. Onyx broadcasts the array it is about to write to storage back to
 * `PersistedRequests`' connect callback, and writes it asynchronously (on web,
 * IndexedDB clones the value only once its transaction opens).
 * `processNextRequest` and `rollbackOngoingRequest` used to `shift()` and
 * `unshift()` that same array in place, which could empty it before the write
 * ran: the in-flight request never reached disk and a reload dropped it (found
 * by `e2e/web/tests/idempotency.spec.ts`).
 */
import * as MockedOnyx from 'react-native-onyx';
import * as PersistedRequests from '@userActions/PersistedRequests';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Request} from '@src/types/onyx';

type Write = {key: string; value: unknown};

// The stores live inside the factory: `jest.mock` is hoisted above the imports,
// and importing PersistedRequests already calls `Onyx.connect`.
jest.mock('react-native-onyx', () => {
  const callbacks = new Map<string, Array<(value: unknown) => void>>();
  const writes: Array<{key: string; value: unknown}> = [];
  return {
    __esModule: true,
    mockWrites: writes,
    default: {
      connect: jest.fn(
        ({
          key,
          callback,
        }: {
          key: string;
          callback: (value: unknown) => void;
        }) => {
          callbacks.set(key, [...(callbacks.get(key) ?? []), callback]);
          return {};
        },
      ),
      // Like Onyx: hand the value to storage (recorded here) and broadcast the
      // same reference to subscribers.
      set: jest.fn((key: string, value: unknown) => {
        writes.push({key, value});
        callbacks.get(key)?.forEach(callback => callback(value));
        return Promise.resolve();
      }),
      multiSet: jest.fn(() => Promise.resolve()),
    },
  };
});

const {mockWrites} = MockedOnyx as unknown as {mockWrites: Write[]};

const request: Request = {
  command: 'UpdateSession',
  data: {idempotencyKey: 'key-1'},
};

/** The value of the latest queue write, as storage received it. */
function lastQueueWrite(): unknown {
  return mockWrites
    .filter(write => write.key === ONYXKEYS.PERSISTED_REQUESTS)
    .at(-1)?.value;
}

describe('PersistedRequests queue writes', () => {
  beforeEach(() => {
    PersistedRequests.clear();
    mockWrites.length = 0;
  });

  it('does not empty the value handed to storage when a request starts processing', () => {
    PersistedRequests.save(request);
    const written = lastQueueWrite();

    expect(PersistedRequests.processNextRequest()).toEqual(request);
    expect(written).toEqual([request]);
  });

  it('does not change that value when the request is rolled back for a retry', () => {
    PersistedRequests.save(request);
    const written = lastQueueWrite();

    PersistedRequests.processNextRequest();
    PersistedRequests.rollbackOngoingRequest();

    expect(written).toEqual([request]);
    expect(PersistedRequests.getAll()).toEqual([
      {...request, isRollbacked: true},
    ]);
  });
});
