/* eslint-disable no-control-regex */
import _ from 'underscore';

/**
 * Checks if parameter is a string or function
 * if it is a function then we will call it with
 * any additional arguments.
 */
function resultFn(parameter: string): string;
function resultFn<R, A extends unknown[]>(
  parameter: (...args: A) => R,
  ...args: A
): R;
function resultFn<R, A extends unknown[]>(
  parameter: string | ((...a: A) => R),
  ...args: A
): string | R {
  if (typeof parameter === 'function') {
    return parameter(...args);
  }

  return parameter;
}

const Str = {
  /**
   * Returns a string containing all the characters str from the beginning
   * of str to the first occurrence of substr.
   * Example: Str.cutAfter( 'hello$%world', '$%' ) // returns 'hello'
   *
   * @param str The string to modify.
   * @param substr The substring to search for.
   * @returns The cut/trimmed string.
   */
  cutAfter(str: string, substr: string): string {
    const index = str.indexOf(substr);
    if (index !== -1) {
      return str.substring(0, index);
    }
    return str;
  },

  /**
   * Returns a string containing all the characters str from after the first
   * occurrence of substr to the end of the string.
   * Example: Str.cutBefore( 'hello$%world', '$%' ) // returns 'world'
   *
   * @param str The string to modify.
   * @param substr The substring to search for.
   * @returns The cut/trimmed string.
   */
  cutBefore(str: string, substr: string): string {
    const index = str.indexOf(substr);
    if (index !== -1) {
      return str.substring(index + substr.length);
    }
    return str;
  },
  /**
   * A simple GUID generator taken from https://stackoverflow.com/a/32760401/9114791
   *
   * @param {String} [prefix] an optional prefix to put in front of the guid
   * @returns {String}
   */
  guid(prefix = ''): string {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return `${prefix}${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  },

  /**
   * Modifies the string so the first letter of the string is capitalized
   *
   * @param {String} str The string to modify.
   * @return {String} The recapitalized string.
   */
  UCFirst(str: string): string {
    return str.substr(0, 1).toUpperCase() + str.substr(1);
  },

  /**
   * Extracts the domain name from the given email address
   * (e.g. "domain.com" for "joe@domain.com").
   *
   * @param email The email address.
   *
   * @returns The domain name in the email address.
   */
  extractEmailDomain(email: string): string {
    return this.cutBefore(email, '@');
  },

  /**
   * Remove all the spaces from a string
   */
  removeSpaces(input: string): string {
    return String(input).replace(' ', '');
  },

  /**
   * Returns the proper phrase depending on the count that is passed.
   * Example:
   * console.log(Str.pluralize('puppy', 'puppies', 1)) { // puppy
   * console.log(Str.pluralize('puppy', 'puppies', 3)) { // puppies
   *
   * @param singular form of the phrase
   * @param plural form of the phrase
   * @param num the count which determines the plurality
   */
  pluralize(singular: string, plural: string, num: number): string {
    if (!num || num > 1) {
      return plural;
    }
    return singular;
  },

  /**
   * Modifies the string so the first letter of each word is capitalized and the
   * rest lowercased.
   *
   * @param val The string to modify
   */
  recapitalize(val: string): string {
    // First replace every letter with its lowercase equivalent
    // Cast to string.
    let str = String(val);
    if (str.length <= 0) {
      return str;
    }
    str = str.substr(0, 1).toUpperCase() + str.substr(1).toLowerCase();

    function recap_callback(t: unknown, a: string, b: string) {
      return a + b.toUpperCase();
    }
    return str.replace(
      // **NOTE: Match to _libfop.php
      /([^A-Za-z'.0-9])([a-z])/g,
      recap_callback,
    );
  },

  /**
   * Checks if parameter is a string or function
   * if it is a function then we will call it with
   * any additional arguments.
   */
  result: resultFn,
};

export default Str;
