/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/prefer-actions-set-data -- this test drives the queue that applies write-request Onyx data; it is not app code */

/**
 * The SequentialQueue parks every write request's response/success data in
 * `QueuedOnyxUpdates` and applies the batch once the persisted queue drains.
 * `Onyx.update` resolves only after its subscriber batch has flushed, so the
 * queue must be handed off synchronously: a second drain inside that window
 * (a write pushed and answered meanwhile, instant against a mocked server)
 * used to apply the same updates twice, and anything queued during the
 * window was wiped by the late clear.
 */
import type {OnyxUpdate} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import * as QueuedOnyxUpdates from '@userActions/QueuedOnyxUpdates';
import ONYXKEYS from '@src/ONYXKEYS';

// Onyx batches updates through react-dom's unstable_batchedUpdates, which is
// undefined in this RN test environment; run the callback synchronously.
jest.mock('react-native-onyx/dist/batch', () => ({
  __esModule: true,
  default: (callback: () => void) => callback(),
}));

const FIRST: OnyxUpdate = {
  onyxMethod: Onyx.METHOD.MERGE,
  key: ONYXKEYS.NETWORK,
  value: {isOffline: true},
};
const SECOND: OnyxUpdate = {
  onyxMethod: Onyx.METHOD.MERGE,
  key: ONYXKEYS.NETWORK,
  value: {isOffline: false},
};

describe('QueuedOnyxUpdates', () => {
  beforeAll(() => {
    Onyx.init({keys: ONYXKEYS});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('applies each queued update exactly once when a second flush runs before the first apply resolves', async () => {
    let resolveFirstApply: () => void = () => {};
    const updateSpy = jest.spyOn(Onyx, 'update').mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveFirstApply = resolve;
        }),
    );

    QueuedOnyxUpdates.queueOnyxUpdates([FIRST]);
    const firstFlush = QueuedOnyxUpdates.flushQueue();
    expect(QueuedOnyxUpdates.isEmpty()).toBe(true);

    // Queued and drained while the first apply is still resolving.
    QueuedOnyxUpdates.queueOnyxUpdates([SECOND]);
    expect(QueuedOnyxUpdates.isEmpty()).toBe(false);
    await QueuedOnyxUpdates.flushQueue();

    resolveFirstApply();
    await firstFlush;

    expect(updateSpy.mock.calls.map(([updates]) => updates)).toEqual([
      [FIRST],
      [SECOND],
    ]);
    expect(QueuedOnyxUpdates.isEmpty()).toBe(true);
  });
});
