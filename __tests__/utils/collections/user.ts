import {
  rand,
  randChanceBoolean,
  randPastDate,
  randUserName,
} from '@ngneat/falso';
import TIMEZONES from '@src/TIMEZONES';
import type {Profile, UserData} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';

type RandUserIDParams = {
  /** The ID length */
  chars?: number;
};

/** Generate a random user ID */
function randUserID({chars = 20}: RandUserIDParams = {}): UserID {
  return Array.from({length: chars}, () =>
    Math.floor(Math.random() * 36).toString(36),
  ).join('');
}

type RandUserIDsParams = {
  /** Number of random user IDs to create */
  length: number;
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
function randUserIDs({length = 50}: RandUserIDsParams): UserID[] {
  if (length <= 0) {
    return [];
  }
  return Array.from({length}, () => randUserID());
}

/**
 * Generate a random user Profile
 *
 * @example
 *
 * randProfile() // {display_name: "John Doe",...}
 */
function randProfile(): Profile {
  return {
    display_name: randUserName(),
    photo_url: '',
  };
}

/**
 * Generate a mock UserData object
 * @param userID ID of the mock user
 * @param index Index of the mock user
 * @param noFriends If set to true, no friends or friend requests will be created.
 * @returns Mock user data
 */
function randUserData(): UserData {
  return {
    ...(randChanceBoolean({chanceTrue: 0.8})
      ? {agreed_to_terms_at: randPastDate().getTime()}
      : {}),
    profile: randProfile(),
    role: 'mock-user',
    timezone: {
      automatic: true,
      selected: rand(TIMEZONES),
    },
  };
}

export {randUserID, randUserIDs, randProfile, randUserData};
