/**
 * @jest-environment node
 */

import {cleanStringForFirebaseKey} from '@libs/StringUtilsKiroku';

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
