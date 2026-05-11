import _ from 'lodash';
import CONST from '@src/CONST';
import hashCode from './hashCode';

/**
 * Removes diacritical marks and non-alphabetic and non-latin characters from a string.
 * @param str - The input string to be sanitized.
 * @returns The sanitized string
 */
function sanitizeString(str: string): string {
  return _.deburr(str)
    .toLowerCase()
    .replaceAll(CONST.REGEX.NON_ALPHABETIC_AND_NON_LATIN_CHARS, '');
}

/**
 *  Check if the string would be empty if all invisible characters were removed.
 */
function isEmptyString(value: string): boolean {
  // Replace valid surrogate pairs (emoji) with a visible placeholder before stripping invisible
  // characters. Babel's transform-unicode-property-regex removes the `u` flag from /[\p{C}]/gu,
  // causing it to match the individual UTF-16 surrogate code units that make up emoji, which
  // would incorrectly strip them. By protecting valid pairs first, lone surrogates (invisible)
  // are still removed while emoji are preserved.
  const withEmojiProtected = value.replace(
    /[\uD800-\uDBFF][\uDC00-\uDFFF]/g,
    'X',
  );

  // \p{C} matches all 'Other' characters
  // \p{Z} matches all separators (spaces etc.)
  // Source: http://www.unicode.org/reports/tr18/#General_Category_Property
  let transformed = withEmojiProtected.replace(
    CONST.REGEX.INVISIBLE_CHARACTERS_GROUPS,
    '',
  );

  // Remove other invisible characters that are not in the above unicode categories
  transformed = transformed.replace(CONST.REGEX.OTHER_INVISIBLE_CHARACTERS, '');

  // Check if after removing invisible characters the string is empty
  return transformed === '';
}

/**
 *  Remove invisible characters from a string except for spaces and format characters for emoji, and trim it.
 */
function removeInvisibleCharacters(value: string): string {
  let result = value;

  // Remove spaces:
  // - \u200B: zero-width space
  // - \u00A0: non-breaking space
  // - \u2060: word joiner
  result = result.replace(/[\u200B\u00A0\u2060]/g, '');

  // Temporarily replace all newlines with non-breaking spaces
  // It is necessary because the next step removes all newlines because they are in the (Cc) category
  result = result.replace(/\n/g, '\u00A0');

  // Remove all characters from the 'Other' (C) category except for format characters (Cf)
  // because some of them are used for emojis
  result = result.replace(/[\p{Cc}\p{Cs}\p{Co}\p{Cn}]/gu, '');

  // Replace all non-breaking spaces with newlines
  result = result.replace(/\u00A0/g, '\n');

  // Remove characters from the (Cf) category that are not used for emojis
  result = result.replace(/[\u200E-\u200F]/g, '');

  // Remove all characters from the 'Separator' (Z) category except for Space Separator (Zs)
  result = result.replace(/[\p{Zl}\p{Zp}]/gu, '');

  // If the result consist of only invisible characters, return an empty string
  if (isEmptyString(result)) {
    return '';
  }

  return result.trim();
}

/**
 *  Replace all CRLF with LF
 *  @param value - The input string
 *  @returns The string with all CRLF replaced with LF
 */
function normalizeCRLF(value?: string): string | undefined {
  return value?.replace(/\r\n/g, '\n');
}

/**
 * Generates a unique hash from a given input string and timestamp, with a customizable length.
 *
 * This function uses SHA-256 to hash a combination of the input string and timestamp,
 * ensuring a unique hash for each unique input. The resulting hash can be truncated
 * to a specified length.
 *
 * @param input - The input string to be hashed.
 * @param timestamp - The timestamp to include in the hash for uniqueness.
 * @param [length=64] - The desired length of the resulting hash. Defaults to 64 characters.
 *                                If specified length is greater than 64, the full hash length (64) will be returned.
 * @returns - A unique hash generated from the input and timestamp, truncated to the specified length.
 *
 * @example
 * // Generates a 16-character hash
 * const hash = generateUniqueHash('exampleString', Date.now(), 16);
 * console.log(hash); // Outputs a unique 16-character hash
 */
function generateUniqueHash(
  input: string,
  timestamp: number,
  length = 64,
): string {
  let data = `${input}-${timestamp}`;

  // Pad or truncate the data to the desired length
  if (data.length < length) {
    data = data.padEnd(length, '0');
  } else if (data.length > length) {
    data = data.substring(0, length);
  }

  const hash = hashCode(data).toString();
  return hash.substring(0, length);
}

export default {
  generateUniqueHash,
  isEmptyString,
  normalizeCRLF,
  removeInvisibleCharacters,
  sanitizeString,
};
