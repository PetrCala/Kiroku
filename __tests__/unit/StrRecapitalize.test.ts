/**
 * @jest-environment node
 */
import Str from '@libs/common/str';

describe('Str.recapitalize', () => {
  describe('accented (non-ASCII) words', () => {
    // Regression: the old ASCII-only regex treated accented letters as word
    // boundaries and uppercased the letter that followed them. In the Czech
    // locale this broke month/day names shown in the statistics date picker
    // (e.g. "červen" -> "ČErven", "úte" -> "ÚTe", "pát" -> "PáT").
    it.each([
      ['červen', 'Červen'],
      ['úte', 'Úte'],
      ['pát', 'Pát'],
      ['únor', 'Únor'],
      ['září', 'Září'],
      ['čtvrtek', 'Čtvrtek'],
      ['neděle', 'Neděle'],
    ])('capitalizes only the first letter of %s', (input, expected) => {
      expect(Str.recapitalize(input)).toBe(expected);
    });
  });

  describe('ASCII multi-word behavior is preserved', () => {
    it.each([
      ['new york', 'New York'],
      ['jean-pierre', 'Jean-Pierre'],
      ['HELLO WORLD', 'Hello World'],
      ['hello', 'Hello'],
    ])('capitalizes the first letter of each word in %s', (input, expected) => {
      expect(Str.recapitalize(input)).toBe(expected);
    });
  });

  it('returns an empty string unchanged', () => {
    expect(Str.recapitalize('')).toBe('');
  });
});
