/**
 * @jest-environment node
 */

import {startOfMonth, subMonths} from 'date-fns';
import {
  canSyncGlobalLastViewedDate,
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

// Rule 2 (per-user independence): the single global last-viewed date may only
// be honoured for the signed-in user's OWN calendar, and a freshly-viewed user
// always opens on today — one user's last-shown month never leaks onto another.
describe('selectCalendarVisibleSource', () => {
  test('self with a last-viewed date restores from it', () => {
    expect(
      selectCalendarVisibleSource({
        isSelf: true,
        hasLastViewed: true,
        localBelongsToViewedUser: true,
      }),
    ).toBe('lastViewed');
  });

  test('self without a last-viewed date uses the local navigated month', () => {
    expect(
      selectCalendarVisibleSource({
        isSelf: true,
        hasLastViewed: false,
        localBelongsToViewedUser: true,
      }),
    ).toBe('local');
  });

  test('self with no last-viewed and no local month falls back to today', () => {
    expect(
      selectCalendarVisibleSource({
        isSelf: true,
        hasLastViewed: false,
        localBelongsToViewedUser: false,
      }),
    ).toBe('today');
  });

  test('a friend NEVER restores from the global last-viewed date', () => {
    // The core Rule 2 guarantee: even when a global last-viewed date exists
    // (set by the signed-in user, or by a previously-viewed friend), another
    // user's calendar must not inherit it.
    const friendCombinations = [
      {hasLastViewed: true, localBelongsToViewedUser: true},
      {hasLastViewed: true, localBelongsToViewedUser: false},
      {hasLastViewed: false, localBelongsToViewedUser: true},
      {hasLastViewed: false, localBelongsToViewedUser: false},
    ];
    friendCombinations.forEach(combo => {
      expect(selectCalendarVisibleSource({isSelf: false, ...combo})).not.toBe(
        'lastViewed',
      );
    });
  });

  test('a freshly-viewed user (no local month tagged for them) opens on today', () => {
    // Reused screen instance, friend A → friend B: B has no local month yet and
    // (being a friend) ignores the global key, so B opens on today.
    expect(
      selectCalendarVisibleSource({
        isSelf: false,
        hasLastViewed: true,
        localBelongsToViewedUser: false,
      }),
    ).toBe('today');
  });

  test('a friend keeps their own in-visit navigated month', () => {
    expect(
      selectCalendarVisibleSource({
        isSelf: false,
        hasLastViewed: true,
        localBelongsToViewedUser: true,
      }),
    ).toBe('local');
  });
});

describe('canSyncGlobalLastViewedDate', () => {
  test('a read-only (friend) surface may not write or clear the global key', () => {
    expect(canSyncGlobalLastViewedDate(true)).toBe(false);
  });

  test("the signed-in user's own calendar may sync the global key", () => {
    expect(canSyncGlobalLastViewedDate(false)).toBe(true);
  });

  test('an unset read-only flag defaults to writable (own calendar)', () => {
    expect(canSyncGlobalLastViewedDate(undefined)).toBe(true);
  });
});
