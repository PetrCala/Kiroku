/**
 * @jest-environment node
 */

import {startOfMonth, subMonths} from 'date-fns';
import {
  computeLoadTarget,
  getCompactCalendarLoadTarget,
  selectCalendarVisibleSource,
} from '@libs/SessionsCalendarUtils';

const BUFFER = 2;

describe('computeLoadTarget', () => {
  test('returns null when earliestVisible is well past the floor', () => {
    const floor = new Date(2026, 0, 1);
    const earliestVisible = new Date(2026, 5, 1);
    expect(computeLoadTarget(earliestVisible, floor, null, BUFFER)).toBeNull();
  });

  test('returns a target when earliestVisible is within the buffer of the floor', () => {
    const floor = new Date(2026, 0, 1);
    const earliestVisible = new Date(2026, 2, 1);
    const target = computeLoadTarget(earliestVisible, floor, null, BUFFER);
    if (!target) {
      throw new Error('expected target to be non-null');
    }
    expect(target.getFullYear()).toBe(2026);
    expect(target.getMonth()).toBe(0);
    expect(target.getDate()).toBe(1);
  });

  test('returns a target when earliestVisible is already past the floor', () => {
    const floor = new Date(2026, 0, 1);
    const earliestVisible = new Date(2025, 10, 1);
    const target = computeLoadTarget(earliestVisible, floor, null, BUFFER);
    if (!target) {
      throw new Error('expected target to be non-null');
    }
    expect(target.getFullYear()).toBe(2025);
    expect(target.getMonth()).toBe(8);
  });

  test('coalesces: returns null when target is not deeper than deepestRequested', () => {
    const floor = new Date(2026, 0, 1);
    const earliestVisible = new Date(2026, 2, 1);
    const deeperAlreadyRequested = new Date(2025, 6, 1);
    expect(
      computeLoadTarget(earliestVisible, floor, deeperAlreadyRequested, BUFFER),
    ).toBeNull();
  });

  test('coalesces: returns target when it would go deeper than the previous request', () => {
    const floor = new Date(2026, 0, 1);
    const earliestVisible = new Date(2025, 8, 1);
    const shallowerPreviousRequest = new Date(2025, 10, 1);
    const target = computeLoadTarget(
      earliestVisible,
      floor,
      shallowerPreviousRequest,
      BUFFER,
    );
    if (!target) {
      throw new Error('expected target to be non-null');
    }
    expect(target.getFullYear()).toBe(2025);
    expect(target.getMonth()).toBe(6);
  });

  test('exact-buffer boundary still triggers a load', () => {
    const floor = new Date(2026, 0, 1);
    const earliestVisible = new Date(2026, BUFFER, 1);
    const target = computeLoadTarget(earliestVisible, floor, null, BUFFER);
    expect(target).not.toBeNull();
  });
});

// Rule 1 (data is always rendered): paging the compact calendar must widen the
// loaded window so the month about to be shown is always inside it — never
// blank until the user moves again. `getCompactCalendarLoadTarget` is the seam
// the page-back handler drives `loadUpTo` with.
describe('getCompactCalendarLoadTarget', () => {
  test('returns the start of `bufferMonths` before the next visible month', () => {
    const nextVisible = new Date(2026, 5, 17); // mid-June 2026
    const target = getCompactCalendarLoadTarget(nextVisible, 3);
    // June − 3 months = March, snapped to the 1st.
    expect(target.getFullYear()).toBe(2026);
    expect(target.getMonth()).toBe(2);
    expect(target.getDate()).toBe(1);
  });

  test('always covers the month about to be shown (target <= its month start)', () => {
    // The Rule 1 invariant: for any buffer, the returned floor is at or before
    // the visible month, so `loadUpTo(target)` includes it in the derived range.
    const nextVisible = new Date(2026, 5, 30);
    [0, 1, 3, 12].forEach(buffer => {
      const target = getCompactCalendarLoadTarget(nextVisible, buffer);
      expect(target.getTime()).toBeLessThanOrEqual(
        startOfMonth(nextVisible).getTime(),
      );
      // …and exactly `buffer` months below it.
      expect(target.getTime()).toBe(
        startOfMonth(subMonths(nextVisible, buffer)).getTime(),
      );
    });
  });

  test('a zero buffer still covers the visible month itself', () => {
    const nextVisible = new Date(2026, 5, 30);
    const target = getCompactCalendarLoadTarget(nextVisible, 0);
    expect(target.getTime()).toBe(startOfMonth(nextVisible).getTime());
  });

  test('a negative buffer is clamped to zero (never pages forward)', () => {
    const nextVisible = new Date(2026, 5, 30);
    const target = getCompactCalendarLoadTarget(nextVisible, -4);
    expect(target.getTime()).toBe(startOfMonth(nextVisible).getTime());
  });

  test('crosses year boundaries correctly', () => {
    const nextVisible = new Date(2026, 1, 10); // February 2026
    const target = getCompactCalendarLoadTarget(nextVisible, 3); // → November 2025
    expect(target.getFullYear()).toBe(2025);
    expect(target.getMonth()).toBe(10);
    expect(target.getDate()).toBe(1);
  });
});

// Rule 2 (per-user independence): the last-viewed date is keyed PER VIEWED USER,
// so the caller passes `hasLastViewed` derived from that user's own slot
// (`map[userID]`). Both the signed-in user and a friend restore from their own
// slot; a user with no slot (cleared on cold launch) opens on today; and one
// user's slot can never reach another's calendar.
describe('selectCalendarVisibleSource', () => {
  test('restores from the per-user last-viewed date when present', () => {
    // Holds regardless of whether a local month is also tagged for this user —
    // the restored scroll position wins. Same precedence for self and friends.
    expect(
      selectCalendarVisibleSource({
        hasLastViewed: true,
        localBelongsToViewedUser: true,
      }),
    ).toBe('lastViewed');
    expect(
      selectCalendarVisibleSource({
        hasLastViewed: true,
        localBelongsToViewedUser: false,
      }),
    ).toBe('lastViewed');
  });

  test('uses the local navigated month when there is no last-viewed date but the local month belongs to this user', () => {
    expect(
      selectCalendarVisibleSource({
        hasLastViewed: false,
        localBelongsToViewedUser: true,
      }),
    ).toBe('local');
  });

  test('a freshly-viewed user (no last-viewed slot, no local month) opens on today', () => {
    // Cold-launch cleared every slot, and a reused screen instance (friend A →
    // friend B) leaves the local month tagged for the previous user, so B opens
    // on today.
    expect(
      selectCalendarVisibleSource({
        hasLastViewed: false,
        localBelongsToViewedUser: false,
      }),
    ).toBe('today');
  });

  test("Rule 2: a user's slot never leaks into another — viewing a user with no slot opens on today, while the other still restores", () => {
    // The independence is structural: the caller derives `hasLastViewed` from
    // `map[viewedUserID]`, so user B (no slot) can never inherit user A's date.
    const lastViewedByUser: Record<string, string> = {userA: '2026-01-15'};

    const viewingB = selectCalendarVisibleSource({
      hasLastViewed: !!lastViewedByUser.userB,
      localBelongsToViewedUser: false,
    });
    expect(viewingB).toBe('today');

    const viewingA = selectCalendarVisibleSource({
      hasLastViewed: !!lastViewedByUser.userA,
      localBelongsToViewedUser: false,
    });
    expect(viewingA).toBe('lastViewed');
  });
});
