import {rand, randChanceBoolean, randPastDate, randUser} from '@ngneat/falso';
import TIMEZONES from '@src/TIMEZONES';
import type {Profile, UserData} from '@src/types/onyx';

/**
 * Generate a random user Profile
 *
 * @example
 *
 * randProfile() // {display_name: "John Doe",...}
 */
function randProfile(): Profile {
  const user = randUser();
  return {
    display_name: user.username,
    photo_url: user.img,
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

export {randProfile, randUserData};
