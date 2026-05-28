import CONST from '@src/CONST';
import Clipboard from '@react-native-clipboard/clipboard';
import seedrandom from 'seedrandom';
import {Alert} from 'react-native';
import * as Localize from './Localize';

/**
 * Clean a string to be used as a key for the Firebase Realtime Database.
 *
 * The function will:
 * 1.Replace any sequence of characters in the 'invalidChars' array or whitespace with a single underscore.
 * 2. Remove any white space from the string.
 * 3. Remove any diacritics.
 * 3. If the string is empty, an underscore will be returned
 *
 * This ensures that for any given input string, the cleaned result is consistent,
 * enabling it to be reliably used as a key in the database.
 *
 * @param rawStr - The raw input string to be cleaned.
 * @returns The cleaned string.
 *
 * @example
 * const rawNickname = "John.Doe #1 č ";
 * const key = cleanStringForFirebaseKey(rawNickname);
 * console.log(key);  // Outputs: "john_doe_1_c"
 */
function cleanStringForFirebaseKey(rawStr: string): string {
  // Trim spaces and normalize the string to its canonical decomposed form.
  const normalizedStr = rawStr.trim().normalize('NFD');

  // Remove diacritical marks and replace invalid characters or whitespace with an underscore.
  const intermediateStr = normalizedStr
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, '_') // No dashes
    .split('')
    .map(char =>
      CONST.INVALID_CHARS.includes(char as '.' | '#' | '$' | '[' | ']') ||
      char.trim() === ''
        ? '_'
        : char,
    )
    .join('');

  // Replace any sequence of underscores and/or whitespaces with a single underscore and convert to lowercase.
  const cleanedStr = intermediateStr.replace(/[_\s]+/g, '_').toLowerCase();

  // If the cleaned string is empty or just "_", return "_". Otherwise, remove trailing underscores.
  return cleanedStr === '' || cleanedStr === '_'
    ? '_'
    : cleanedStr.replace(/_+$/, '');
}

/**
 * Split a display name into its individual word tokens, cleaned for use as
 * Firebase keys. Words are split on whitespace and dashes. Empty/invalid
 * tokens (those that clean down to "_") are dropped, and the result is deduped.
 *
 * @example getNicknameWordKeys("Anne-Marie Doe") // ["anne", "marie", "doe"]
 */
function getNicknameWordKeys(displayName: string): string[] {
  const words = displayName
    .split(/[\s-]+/)
    .map(word => cleanStringForFirebaseKey(word))
    .filter(key => key !== '_');
  return Array.from(new Set(words));
}

/**
 * The full set of Firebase index keys a user should be stored under so they
 * are findable by any word in their name. Combines the full normalized name
 * with each individual word token. Falls back to ["_"] for all-invalid names
 * so the user always has at least one index entry.
 *
 * @example getNicknameKeys("John Doe") // ["john_doe", "john", "doe"]
 */
function getNicknameKeys(displayName: string): string[] {
  const fullKey = cleanStringForFirebaseKey(displayName);
  const keys = [fullKey, ...getNicknameWordKeys(displayName)].filter(
    key => key !== '_',
  );
  const unique = Array.from(new Set(keys)).slice(
    0,
    CONST.NICKNAME_INDEX.MAX_TOKENS,
  );
  return unique.length > 0 ? unique : ['_'];
}

/** Determine whether a number should be pluralized. */
function shouldUsePlural(input: number): boolean {
  return input !== 1;
}

function getPlural(input: number): string {
  return shouldUsePlural(input) ? 's' : '';
}

/** If a string is equal to 00:00, return a dash. Otherwise return the string. */
function nonMidnightString(string: string): string {
  return string === '00:00' ? '-' : string;
}

function generateRandomString(length: number, seed: string): string {
  const rng = seedrandom(seed); // Create a new seeded RNG
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(rng() * charactersLength));
  }
  return result;
}

/**
 * Copy a text to a clipboard
 *
 * @param text - The text to be copied to the clipboard
 * @param alert - If true, an alert will be shown to the user
 * @param successTitle - The title of the success alert
 * @param successText - The text of the success alert
 * */
const copyToClipboard = (
  text: string,
  alert?: boolean,
  successTitle?: string,
  successText?: string,
) => {
  const title = successTitle ?? Localize.translateLocal('common.success');
  const message =
    successText ?? Localize.translateLocal('common.copiedToClipboard');

  Clipboard.setString(text);
  if (alert) {
    Alert.alert(title, message);
  }
};

function UCFirst(str: string) {
  return str.substr(0, 1).toUpperCase() + str.substr(1);
}

export {
  UCFirst,
  cleanStringForFirebaseKey,
  copyToClipboard,
  generateRandomString,
  getNicknameKeys,
  getNicknameWordKeys,
  getPlural,
  nonMidnightString,
  shouldUsePlural,
};
