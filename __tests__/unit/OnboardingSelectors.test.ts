/**
 * @jest-environment node
 */

import {
  getOnboardingLastVisitedPath,
  hasAcceptedCurrentTerms,
  hasCompletedOnboarding,
  isLegacyGrandfatheredUser,
} from '@src/libs/OnboardingSelectors';
import type {Config, UserData} from '@src/types/onyx';

function makeUserData(overrides: Partial<UserData> = {}): UserData {
  return {
    profile: {
      display_name: 'placeholder',
      photo_url: '',
    },
    role: 'open_beta_user',
    ...overrides,
  };
}

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    app_settings: {},
    maintenance: {maintenance_mode: false},
    ...overrides,
  };
}

describe('OnboardingSelectors', () => {
  describe('hasCompletedOnboarding', () => {
    test('returns false for undefined userData (brand-new account)', () => {
      expect(hasCompletedOnboarding(undefined)).toBe(false);
    });

    test('returns false when onboarding node is missing', () => {
      expect(hasCompletedOnboarding(makeUserData())).toBe(false);
    });

    test('returns false for empty object onboarding', () => {
      expect(hasCompletedOnboarding(makeUserData({onboarding: {}}))).toBe(
        false,
      );
    });

    test('returns false for empty array onboarding (RTDB serialization)', () => {
      const userData = makeUserData({
        onboarding: [] as unknown as UserData['onboarding'],
      });
      expect(hasCompletedOnboarding(userData)).toBe(false);
    });

    test('returns true when completed_at is set', () => {
      const userData = makeUserData({
        onboarding: {completed_at: 1_700_000_000_000},
      });
      expect(hasCompletedOnboarding(userData)).toBe(true);
    });

    test('returns false when only last_visited_path is set (in progress)', () => {
      const userData = makeUserData({
        onboarding: {last_visited_path: '/onboarding/terms'},
      });
      expect(hasCompletedOnboarding(userData)).toBe(false);
    });
  });

  describe('hasAcceptedCurrentTerms', () => {
    const PUBLISHED_AT = 1_700_000_000_000;

    test('returns false for undefined userData', () => {
      expect(hasAcceptedCurrentTerms(undefined, makeConfig())).toBe(false);
    });

    test('returns false when the user has never accepted (new account)', () => {
      // Independent of config so the onboarding terms step always shows.
      expect(hasAcceptedCurrentTerms(makeUserData(), undefined)).toBe(false);
      expect(
        hasAcceptedCurrentTerms(
          makeUserData(),
          makeConfig({terms_last_updated: PUBLISHED_AT}),
        ),
      ).toBe(false);
    });

    test('fails open (true) once accepted when config is not loaded', () => {
      const userData = makeUserData({agreed_to_terms_at: PUBLISHED_AT});
      expect(hasAcceptedCurrentTerms(userData, undefined)).toBe(true);
    });

    test('fails open (true) once accepted when terms_last_updated is unset', () => {
      const userData = makeUserData({agreed_to_terms_at: PUBLISHED_AT});
      expect(hasAcceptedCurrentTerms(userData, makeConfig())).toBe(true);
    });

    test('returns true when accepted after terms were published', () => {
      const userData = makeUserData({agreed_to_terms_at: PUBLISHED_AT + 1});
      const config = makeConfig({terms_last_updated: PUBLISHED_AT});
      expect(hasAcceptedCurrentTerms(userData, config)).toBe(true);
    });

    test('returns true when accepted exactly at publish time', () => {
      const userData = makeUserData({agreed_to_terms_at: PUBLISHED_AT});
      const config = makeConfig({terms_last_updated: PUBLISHED_AT});
      expect(hasAcceptedCurrentTerms(userData, config)).toBe(true);
    });

    test('returns false when accepted before terms were published (re-consent)', () => {
      const userData = makeUserData({agreed_to_terms_at: PUBLISHED_AT - 1});
      const config = makeConfig({terms_last_updated: PUBLISHED_AT});
      expect(hasAcceptedCurrentTerms(userData, config)).toBe(false);
    });
  });

  describe('isLegacyGrandfatheredUser', () => {
    test('returns false for undefined userData', () => {
      expect(isLegacyGrandfatheredUser(undefined)).toBe(false);
    });

    test('returns false when agreed_to_terms_at is missing (new account)', () => {
      expect(isLegacyGrandfatheredUser(makeUserData())).toBe(false);
    });

    test('returns true when terms_at set and username_chosen is undefined', () => {
      const userData = makeUserData({
        agreed_to_terms_at: 1_700_000_000_000,
      });
      expect(isLegacyGrandfatheredUser(userData)).toBe(true);
    });

    test('returns true when terms_at set and username_chosen is true', () => {
      const userData = makeUserData({
        agreed_to_terms_at: 1_700_000_000_000,
        profile: {
          display_name: 'name',
          photo_url: '',
          username_chosen: true,
        },
      });
      expect(isLegacyGrandfatheredUser(userData)).toBe(true);
    });

    test('returns false when username_chosen is false (still owes display-name step)', () => {
      const userData = makeUserData({
        agreed_to_terms_at: 1_700_000_000_000,
        profile: {
          display_name: 'name',
          photo_url: '',
          username_chosen: false,
        },
      });
      expect(isLegacyGrandfatheredUser(userData)).toBe(false);
    });
  });

  describe('getOnboardingLastVisitedPath', () => {
    test('returns undefined when userData is undefined', () => {
      expect(getOnboardingLastVisitedPath(undefined)).toBeUndefined();
    });

    test('returns undefined when onboarding is missing', () => {
      expect(getOnboardingLastVisitedPath(makeUserData())).toBeUndefined();
    });

    test('returns undefined when onboarding is an empty array', () => {
      const userData = makeUserData({
        onboarding: [] as unknown as UserData['onboarding'],
      });
      expect(getOnboardingLastVisitedPath(userData)).toBeUndefined();
    });

    test('returns last_visited_path when set', () => {
      const userData = makeUserData({
        onboarding: {last_visited_path: '/onboarding/display-name'},
      });
      expect(getOnboardingLastVisitedPath(userData)).toBe(
        '/onboarding/display-name',
      );
    });
  });
});
