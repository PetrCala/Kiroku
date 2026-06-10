/**
 * @jest-environment node
 */

import ProfanityFilter from '@src/libs/ProfanityFilter';

describe('ProfanityFilter', () => {
  describe('containsProfanity', () => {
    test('Should return false for a clean name', () => {
      expect(ProfanityFilter.containsProfanity('Petr Cala')).toBe(false);
    });

    test('Should return false for an empty string', () => {
      expect(ProfanityFilter.containsProfanity('')).toBe(false);
    });

    test('Should catch an obvious slur', () => {
      expect(ProfanityFilter.containsProfanity('you are a fucker')).toBe(true);
    });

    test('Should catch a leetspeak/obfuscated variant', () => {
      expect(ProfanityFilter.containsProfanity('fvck')).toBe(true);
      expect(ProfanityFilter.containsProfanity('sh1t')).toBe(true);
    });

    test('Should not flag clean words that embed a profane substring', () => {
      // The recommended whitelist transformers guard against false positives
      // like "Scunthorpe" or "assassin".
      expect(ProfanityFilter.containsProfanity('Scunthorpe')).toBe(false);
      expect(ProfanityFilter.containsProfanity('assassin')).toBe(false);
    });
  });
});
