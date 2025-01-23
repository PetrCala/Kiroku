import {randUuid} from '@ngneat/falso';

/**
 * Generate a random key that can be used to index database items
 *
 * @example
 *
 * randDbKey()
 */
function randDbKey(): string {
  return randUuid();
}

export {
  // eslint-disable-next-line import/prefer-default-export
  randDbKey,
};
