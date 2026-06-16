/**
 * @jest-environment node
 */

import {
  calculateAllUsersPriority,
  calculateUserPriority,
  orderUsersByPriority,
} from '@libs/algorithms/DisplayPriority';
import type {UserStatus, UserStatusList} from '@src/types/onyx';

// A recent, non-expired ongoing session (expiry boundary is now - 12h, see
// `DrinkingSessionUtils.sessionIsExpired`). One minute ago keeps the time
// coefficient finite and the session active.
const ACTIVE_STATUS: UserStatus = {
  last_online: Date.now(),
  latest_session: {start_time: Date.now() - 60_000, ongoing: true},
};

// A visible friend with presence but no session at all → floored priority.
const IDLE_STATUS: UserStatus = {last_online: Date.now()};

describe('libs/algorithms/DisplayPriority.calculateAllUsersPriority', () => {
  it('floors a user absent from the status list to the same priority as an idle visible friend', () => {
    // The regression guard: a hidden friend (the server evicts their
    // `user_status`, so they're absent here) used to default to `0` and float
    // ABOVE idle visible friends (`-1e10`). They must now share the bottom band.
    const statusList: UserStatusList = {idle: IDLE_STATUS};
    const priorities = calculateAllUsersPriority(
      ['hidden', 'idle'],
      statusList,
    );

    expect(priorities.hidden).toBe(priorities.idle);
  });

  it('ranks an active-session friend above a hidden (absent) friend', () => {
    const statusList: UserStatusList = {active: ACTIVE_STATUS};
    const priorities = calculateAllUsersPriority(
      ['hidden', 'active'],
      statusList,
    );

    expect(priorities.active).toBeGreaterThan(priorities.hidden);
  });
});

describe('libs/algorithms/DisplayPriority.calculateUserPriority', () => {
  it('returns the same floor whether latest_session is null or undefined', () => {
    const nullSession: UserStatus = {
      last_online: Date.now(),
      latest_session: null,
    };
    const noSession: UserStatus = {last_online: Date.now()};

    expect(calculateUserPriority(nullSession)).toBe(
      calculateUserPriority(noSession),
    );
  });

  it('scores an active session well above an idle one', () => {
    expect(calculateUserPriority(ACTIVE_STATUS)).toBeGreaterThan(
      calculateUserPriority(IDLE_STATUS),
    );
  });
});

describe('libs/algorithms/DisplayPriority.orderUsersByPriority', () => {
  it('sorts active friends first and never places a hidden friend above an active one', () => {
    const statusList: UserStatusList = {
      active: ACTIVE_STATUS,
      idle: IDLE_STATUS,
      // `hidden` is intentionally absent — the hidden-data case.
    };
    const userIDs = ['hidden', 'idle', 'active'];
    const priorities = calculateAllUsersPriority(userIDs, statusList);

    const ordered = orderUsersByPriority(userIDs, priorities);

    expect(ordered[0]).toBe('active');
    expect(ordered.indexOf('hidden')).toBeGreaterThan(
      ordered.indexOf('active'),
    );
  });

  it('does not mutate the input array', () => {
    const userIDs = ['a', 'b'];
    orderUsersByPriority(userIDs, {a: 1, b: 2});

    expect(userIDs).toEqual(['a', 'b']);
  });
});
