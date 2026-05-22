/**
 * @jest-environment node
 */

import {computeLoadTarget} from '@libs/SessionsCalendarUtils';

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
