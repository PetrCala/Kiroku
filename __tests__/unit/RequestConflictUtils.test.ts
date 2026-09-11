import type {OnyxUpdate} from 'react-native-onyx';
import {WRITE_COMMANDS} from '@libs/API/types';
import {
  resolveCoalescingConflictAction,
  resolveDuplicationConflictAction,
} from '@userActions/RequestConflictUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import type OnyxRequest from '@src/types/onyx/Request';

function marker(value: number): OnyxUpdate {
  return {
    onyxMethod: 'merge',
    key: ONYXKEYS.NETWORK,
    value: {timeSkew: value},
  };
}

function request(
  data: Record<string, unknown>,
  extra: Partial<OnyxRequest> = {},
): OnyxRequest {
  return {command: WRITE_COMMANDS.SESSION_OP, data, ...extra};
}

const lastIndex = (requests: OnyxRequest[]) => requests.length - 1;
const mergeData = (queued: OnyxRequest, incoming: OnyxRequest) => ({
  ...queued.data,
  ...incoming.data,
});

describe('resolveDuplicationConflictAction (the ReconnectApp dedupe)', () => {
  const isReconnect = (r: OnyxRequest) =>
    r.command === WRITE_COMMANDS.RECONNECT_APP;

  it('replaces a queued duplicate in place', () => {
    const queue = [
      {command: WRITE_COMMANDS.UPDATE_SESSION},
      {command: WRITE_COMMANDS.RECONNECT_APP},
    ];
    expect(resolveDuplicationConflictAction(queue, isReconnect)).toEqual({
      conflictAction: {type: 'replace', index: 1},
    });
  });

  it('pushes when nothing matches', () => {
    expect(
      resolveDuplicationConflictAction(
        [{command: WRITE_COMMANDS.UPDATE_SESSION}],
        isReconnect,
      ),
    ).toEqual({conflictAction: {type: 'push'}});
  });
});

describe('resolveCoalescingConflictAction', () => {
  const queued = request(
    {idempotencyKey: 'key-queued', count: 1, note: 'a'},
    {
      successData: [marker(1)],
      failureData: [marker(2)],
      finallyData: [marker(3)],
    },
  );
  const incoming = request(
    {idempotencyKey: 'key-incoming', count: 3},
    {
      successData: [marker(4)],
      failureData: [marker(5)],
      finallyData: [marker(6)],
      checkAndFixConflictingRequest: () => ({conflictAction: {type: 'push'}}),
    },
  );

  it('replaces the queued request with the merged one, under the new key', () => {
    const {conflictAction} = resolveCoalescingConflictAction(
      [request({other: true}), queued],
      incoming,
      lastIndex,
      mergeData,
    );
    expect(conflictAction.type).toBe('replace');
    if (conflictAction.type !== 'replace') {
      return;
    }
    expect(conflictAction.index).toBe(1);
    const merged = conflictAction.request;
    // Later values win, and the merge takes the incoming request's key, so
    // the server can't answer it from a record of the queued request alone.
    expect(merged?.data).toEqual({
      idempotencyKey: 'key-incoming',
      count: 3,
      note: 'a',
    });
    // Success and finally data run in order; failure data undoes newest first.
    expect(merged?.successData).toEqual([marker(1), marker(4)]);
    expect(merged?.finallyData).toEqual([marker(3), marker(6)]);
    expect(merged?.failureData).toEqual([marker(5), marker(2)]);
    // The resolver function never ends up in the persisted queue.
    expect(merged).not.toHaveProperty('checkAndFixConflictingRequest');
  });

  it('pushes when the two requests can not be merged', () => {
    expect(
      resolveCoalescingConflictAction(
        [queued],
        incoming,
        lastIndex,
        () => undefined,
      ),
    ).toEqual({conflictAction: {type: 'push'}});
  });

  it('pushes when there is no candidate', () => {
    expect(
      resolveCoalescingConflictAction([queued], incoming, () => -1, mergeData),
    ).toEqual({conflictAction: {type: 'push'}});
  });

  it('never merges into a request that was already attempted', () => {
    const attempted = {...queued, isRollbacked: true};
    expect(
      resolveCoalescingConflictAction(
        [attempted],
        incoming,
        lastIndex,
        mergeData,
      ),
    ).toEqual({conflictAction: {type: 'push'}});
  });
});
