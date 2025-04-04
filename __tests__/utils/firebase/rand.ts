import {randUuid} from '@ngneat/falso';
import type {UserID} from '@src/types/onyx/OnyxCommon';

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

type RandUserIDParams = {
  /** The ID length */
  chars?: number;
};

/** Generate a random user ID */
function randUserID({chars = 28}: RandUserIDParams = {}): UserID {
  return Array.from({length: chars}, () =>
    Math.floor(Math.random() * 36).toString(36),
  ).join('');
}

type RandUserIDsParams = {
  /** Number of random user IDs to create */
  length?: number;
};

/**
 * Generate an array of mock user IDs.
 *
 * @example
 *
 * randUserIDs() // ['asdf12hk1h9d', '1239asdfh9123h',...]
 *
 * @example
 *
 * randUserIds({length: 5})
 */
function randUserIDs({length = 50}: RandUserIDsParams = {}): UserID[] {
  if (length <= 0) {
    return [];
  }
  return Array.from({length}, () => randUserID());
}

export {randDbKey, randUserID, randUserIDs};
