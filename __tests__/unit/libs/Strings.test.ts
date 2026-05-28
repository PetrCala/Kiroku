/**
 * @jest-environment node
 */

import {
  cleanStringForFirebaseKey,
  getNicknameKeys,
  getNicknameWordKeys,
} from '@libs/StringUtilsKiroku';

describe('cleanStringForFirebaseKey', () => {
  const testCleanString = (input: string, expected: string) => {
    const output = cleanStringForFirebaseKey(input);
    expect(output).toBe(expected);
  };

  it('should replace sequences of invalid characters and/or whitespaces with a single underscore', () => {
    testCleanString('.#   []$', '_');
  });

  it('should handle strings with interspersed valid characters correctly', () => {
    testCleanString('John .#[]$ Doe', 'john_doe');
  });

  it('should handle empty strings', () => {
    testCleanString('', '_');
  });

  it('should handle strings without invalid characters or spaces', () => {
    testCleanString('JohnDoe', 'johndoe');
  });

  it('should handle only spaces', () => {
    testCleanString('   ', '_');
  });

  it('should handle strings with diacritics', () => {
    testCleanString('Jöhn Doe éšč', 'john_doe_esc');
  });

  it('should handle spaces at the beginning/end', () => {
    testCleanString(' John Doe', 'john_doe');
  });

  it('should handle a complex case', () => {
    testCleanString('John.Doe #1 č ', 'john_doe_1_c');
  });

  it('should replace dashes with underscores', () => {
    testCleanString('mock-user', 'mock_user');
  });
});

describe('getNicknameWordKeys', () => {
  it('splits a multi-word name into cleaned word tokens', () => {
    expect(getNicknameWordKeys('John Doe')).toEqual(['john', 'doe']);
  });

  it('returns a single token for a single-word name', () => {
    expect(getNicknameWordKeys('Cher')).toEqual(['cher']);
  });

  it('splits on dashes as well as whitespace', () => {
    expect(getNicknameWordKeys('Anne-Marie Doe')).toEqual([
      'anne',
      'marie',
      'doe',
    ]);
  });

  it('strips diacritics per word', () => {
    expect(getNicknameWordKeys('Jöhn éšč')).toEqual(['john', 'esc']);
  });

  it('dedupes repeated words', () => {
    expect(getNicknameWordKeys('John John')).toEqual(['john']);
  });

  it('drops invalid-only words', () => {
    expect(getNicknameWordKeys('John #$.')).toEqual(['john']);
  });

  it('returns an empty array for all-invalid or empty input', () => {
    expect(getNicknameWordKeys('#$.')).toEqual([]);
    expect(getNicknameWordKeys('')).toEqual([]);
  });
});

describe('getNicknameKeys', () => {
  it('combines the full normalized name with each word token', () => {
    expect(getNicknameKeys('John Doe')).toEqual(['john_doe', 'john', 'doe']);
  });

  it('dedupes the full key against a single-word name', () => {
    expect(getNicknameKeys('Cher')).toEqual(['cher']);
  });

  it('handles hyphenated names', () => {
    expect(getNicknameKeys('Anne-Marie')).toEqual([
      'anne_marie',
      'anne',
      'marie',
    ]);
  });

  it('falls back to ["_"] for all-invalid names', () => {
    expect(getNicknameKeys('#$.')).toEqual(['_']);
    expect(getNicknameKeys('')).toEqual(['_']);
  });

  it('caps the number of tokens', () => {
    const longName = 'a b c d e f g h i j k l';
    expect(getNicknameKeys(longName).length).toBeLessThanOrEqual(8);
  });
});
