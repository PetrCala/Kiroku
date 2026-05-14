/**
 * @jest-environment node
 */

import {cleanSemver, isNonEmptyObject, validateSemver} from '@libs/Validation';

describe('isNonEmptyObject', () => {
  it('should return true for non-empty objects', () => {
    const nonEmptyObject = {key: 'value'};
    expect(isNonEmptyObject(nonEmptyObject)).toBeTruthy();
  });

  it('should return false for empty objects', () => {
    const emptyObject = {};
    expect(isNonEmptyObject(emptyObject)).toBeFalsy();
  });

  it('should return false for non-object types', () => {
    const testData = [
      42,
      'string',
      true,
      null,
      undefined,
      [],
      () => {},
      Symbol('sym'),
    ];
    testData.forEach(value => {
      expect(isNonEmptyObject(value)).toBeFalsy();
    });
  });

  it('should not throw an exception for null or undefined values', () => {
    const values = [null, undefined];
    values.forEach(value => {
      expect(() => isNonEmptyObject(value)).not.toThrow();
    });
  });

  it('should return false for arrays, even if they are not empty', () => {
    const nonEmptyArray = [1, 2, 3];
    expect(isNonEmptyObject(nonEmptyArray)).toBeFalsy();
  });

  it('should return false undefined', () => {
    const nonEmptyArray = undefined;
    expect(isNonEmptyObject(nonEmptyArray)).toBeFalsy();
  });
});

describe('Test the validateSemver function', () => {
  it('validates correct SemVer strings', () => {
    expect(() => validateSemver('1.0.0')).not.toThrow();
    expect(() => validateSemver('2.10.3-alpha.1+build.456')).not.toThrow();
    expect(() => validateSemver('0.0.4')).not.toThrow();
    expect(() => validateSemver('1.2.3-4')).not.toThrow();
    expect(() => validateSemver('1.2.3-4+build')).not.toThrow();
    expect(() => validateSemver('1.2.3+20200101')).not.toThrow();
  });
  it('throws an error for invalid SemVer strings', () => {
    expect(() => validateSemver('01.0.0')).toThrow('Invalid SemVer version.');
    expect(() => validateSemver('1.0')).toThrow('Invalid SemVer version.');
    expect(() => validateSemver('1.0.0.0')).toThrow('Invalid SemVer version.');
    expect(() => validateSemver('abc')).toThrow('Invalid SemVer version.');
    expect(() => validateSemver('1.2')).toThrow('Invalid SemVer version.');
    expect(() => validateSemver('')).toThrow('Invalid SemVer version.');
  });

  it('throws an error for non-strings', () => {
    // @ts-expect-error An invalid semver is passed
    expect(() => validateSemver(1)).toThrow('Invalid SemVer version.');
    // @ts-expect-error An invalid semver is passed
    expect(() => validateSemver(undefined)).toThrow('Invalid SemVer version.');
    // @ts-expect-error An invalid semver is passed
    expect(() => validateSemver(null)).toThrow('Invalid SemVer version.');
    // @ts-expect-error An invalid semver is passed
    expect(() => validateSemver([1, 2, 3])).toThrow('Invalid SemVer version.');
    // @ts-expect-error An invalid semver is passed
    expect(() => validateSemver({a: 1})).toThrow('Invalid SemVer version.');
  });

  it('validates versions with or without v prefix', () => {
    expect(() => validateSemver('v1.0.0')).not.toThrow();
    expect(() => validateSemver('v2.10.3-alpha.1+build.456')).not.toThrow();
  });
});

describe('Test the cleanSemver function', () => {
  it('should remove build metadata from semver string', () => {
    expect(cleanSemver('1.0.0-1')).toBe('1.0.0');
    expect(cleanSemver('2.1.3-45')).toBe('2.1.3');
    expect(cleanSemver('0.2.0-2')).toBe('0.2.0');
  });

  it('should return the core version for semver strings without build metadata', () => {
    expect(cleanSemver('1.0.0')).toBe('1.0.0');
    expect(cleanSemver('2.1.3')).toBe('2.1.3');
    expect(cleanSemver('0.2.0')).toBe('0.2.0');
  });

  it('should handle semver strings with pre-release versions correctly', () => {
    expect(cleanSemver('1.0.0-alpha.1')).toBe('1.0.0');
    expect(cleanSemver('2.1.3-beta.3+exp.sha.5114f85')).toBe('2.1.3');
  });

  it('should return the original string if it does not match semver format', () => {
    expect(cleanSemver('v1.0')).toBe('v1.0');
    expect(cleanSemver('1.0')).toBe('1.0');
    expect(cleanSemver('abc')).toBe('abc');
  });
});

// TODO test isNonEmptyArray
