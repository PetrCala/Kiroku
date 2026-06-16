/**
 * @jest-environment node
 */

import {getFeatureAccess, getPremiumFeatureKeys} from '@libs/Entitlements';
import type {FeatureAccessContext, PremiumFeatureKey} from '@libs/Entitlements';

// A controlled registry so the resolver matrix can cover free, plus, and
// availability-flagged features independent of the real app registry.
// `FeatureFlags.isEnabled` reads `CONST.FEATURES` from this same mock.
jest.mock('@src/CONST', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- ES module interop flag required for default-export mocks.
  __esModule: true,
  default: {
    FEATURES: {
      FLAG_ON: true,
      FLAG_OFF: false,
    },
    PREMIUM_FEATURES: {
      FREE_FEATURE: {tier: 'free'},
      PLUS_FEATURE: {tier: 'plus'},
      PLUS_FLAG_ON: {tier: 'plus', availabilityFlag: 'FLAG_ON'},
      PLUS_FLAG_OFF: {tier: 'plus', availabilityFlag: 'FLAG_OFF'},
    },
  },
}));

// The real `PremiumFeatureKey` type is derived from the real CONST, which the
// runtime mock can't change. Cast test keys through this helper.
function resolve(feature: string, context: Partial<FeatureAccessContext> = {}) {
  const fullContext: FeatureAccessContext = {
    isSupporter: false,
    isSupporterStatusLoading: false,
    devOverride: undefined,
    gatesActive: true,
    ...context,
  };
  return getFeatureAccess(feature as PremiumFeatureKey, fullContext);
}

describe('libs/Entitlements.getPremiumFeatureKeys', () => {
  it('returns the registered feature keys', () => {
    expect(getPremiumFeatureKeys()).toEqual([
      'FREE_FEATURE',
      'PLUS_FEATURE',
      'PLUS_FLAG_ON',
      'PLUS_FLAG_OFF',
    ]);
  });
});

describe('libs/Entitlements.getFeatureAccess', () => {
  describe('availability flag (step 1, beats everything)', () => {
    it('marks the feature unavailable when its flag is off', () => {
      expect(resolve('PLUS_FLAG_OFF')).toEqual({
        isAvailable: false,
        isLocked: false,
        requiresPlus: false,
        tier: 'plus',
        isResolving: false,
      });
    });

    it('stays unavailable even with a dev unlock override', () => {
      const access = resolve('PLUS_FLAG_OFF', {
        devOverride: 'unlocked',
        isSupporter: true,
      });
      expect(access.isAvailable).toBe(false);
      expect(access.isLocked).toBe(false);
    });

    it('behaves like a normal plus feature when its flag is on', () => {
      expect(
        resolve('PLUS_FLAG_ON', {gatesActive: true, isSupporter: false}),
      ).toEqual({
        isAvailable: true,
        isLocked: true,
        requiresPlus: true,
        tier: 'plus',
        isResolving: false,
      });
    });
  });

  describe('dev override (step 2, beats tier/gates/supporter)', () => {
    it('unlocks a locked plus feature', () => {
      const access = resolve('PLUS_FEATURE', {
        devOverride: 'unlocked',
        gatesActive: true,
        isSupporter: false,
      });
      expect(access.isLocked).toBe(false);
      expect(access.isAvailable).toBe(true);
      expect(access.requiresPlus).toBe(true);
    });

    it('locks a feature even for a supporter', () => {
      const access = resolve('PLUS_FEATURE', {
        devOverride: 'locked',
        gatesActive: true,
        isSupporter: true,
      });
      expect(access.isLocked).toBe(true);
      expect(access.isResolving).toBe(false);
    });

    it('overrides while supporter status is still loading', () => {
      const access = resolve('PLUS_FEATURE', {
        devOverride: 'unlocked',
        isSupporterStatusLoading: true,
      });
      expect(access.isResolving).toBe(false);
      expect(access.isLocked).toBe(false);
    });
  });

  describe('free tier (step 3)', () => {
    it('is always unlocked and never requires plus', () => {
      const access = resolve('FREE_FEATURE', {
        gatesActive: true,
        isSupporter: false,
      });
      expect(access).toEqual({
        isAvailable: true,
        isLocked: false,
        requiresPlus: false,
        tier: 'free',
        isResolving: false,
      });
    });
  });

  describe('plus tier, gates inactive (step 4 — ships free)', () => {
    it('is an unlocked placeholder that still requires plus', () => {
      expect(
        resolve('PLUS_FEATURE', {gatesActive: false, isSupporter: false}),
      ).toEqual({
        isAvailable: true,
        isLocked: false,
        requiresPlus: true,
        tier: 'plus',
        isResolving: false,
      });
    });

    it('ignores a loading status (no resolving) when gates are inactive', () => {
      const access = resolve('PLUS_FEATURE', {
        gatesActive: false,
        isSupporterStatusLoading: true,
      });
      expect(access.isResolving).toBe(false);
      expect(access.isLocked).toBe(false);
    });
  });

  describe('plus tier, gates active, status loading (step 5 — no flicker)', () => {
    it('is unlocked and resolving regardless of supporter flag', () => {
      const access = resolve('PLUS_FEATURE', {
        gatesActive: true,
        isSupporterStatusLoading: true,
        isSupporter: false,
      });
      expect(access).toEqual({
        isAvailable: true,
        isLocked: false,
        requiresPlus: true,
        tier: 'plus',
        isResolving: true,
      });
    });
  });

  describe('plus tier, gates active, status loaded (step 6)', () => {
    it('locks a non-supporter', () => {
      const access = resolve('PLUS_FEATURE', {
        gatesActive: true,
        isSupporter: false,
      });
      expect(access.isLocked).toBe(true);
      expect(access.isResolving).toBe(false);
    });

    it('unlocks a supporter', () => {
      const access = resolve('PLUS_FEATURE', {
        gatesActive: true,
        isSupporter: true,
      });
      expect(access.isLocked).toBe(false);
      expect(access.requiresPlus).toBe(true);
    });
  });
});
