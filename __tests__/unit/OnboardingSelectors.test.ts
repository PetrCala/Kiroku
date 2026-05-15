/**
 * @jest-environment node
 */

import CONST from '@src/CONST';
import {
  hasAcceptedCurrentTerms,
  hasCompletedOnboarding,
} from '@src/libs/OnboardingSelectors';

describe('OnboardingSelectors', () => {
  describe('hasCompletedOnboarding', () => {
    test('returns true for undefined (grandfathered legacy user)', () => {
      expect(hasCompletedOnboarding(undefined)).toBe(true);
    });

    test('returns true for empty array (Firebase RTDB empty-object serialization)', () => {
      expect(hasCompletedOnboarding([])).toBe(true);
    });

    test('returns true for empty object', () => {
      expect(hasCompletedOnboarding({})).toBe(true);
    });

    test('returns true when completed_at is set', () => {
      expect(hasCompletedOnboarding({completed_at: 1_700_000_000_000})).toBe(
        true,
      );
    });

    test('returns true when both fields are set', () => {
      expect(
        hasCompletedOnboarding({
          completed_at: 1_700_000_000_000,
          last_visited_path: '/onboarding/terms',
        }),
      ).toBe(true);
    });

    test('returns false when only last_visited_path is set (in progress)', () => {
      expect(
        hasCompletedOnboarding({last_visited_path: '/onboarding/terms'}),
      ).toBe(false);
    });
  });

  describe('hasAcceptedCurrentTerms', () => {
    test('returns true when stored version matches CURRENT_TERMS_VERSION', () => {
      expect(hasAcceptedCurrentTerms(CONST.CURRENT_TERMS_VERSION)).toBe(true);
    });

    test('returns false for undefined', () => {
      expect(hasAcceptedCurrentTerms(undefined)).toBe(false);
    });

    test('returns false for an older version', () => {
      expect(hasAcceptedCurrentTerms(CONST.CURRENT_TERMS_VERSION - 1)).toBe(
        false,
      );
    });

    test('returns false for a newer version (defensive)', () => {
      expect(hasAcceptedCurrentTerms(CONST.CURRENT_TERMS_VERSION + 1)).toBe(
        false,
      );
    });
  });
});
