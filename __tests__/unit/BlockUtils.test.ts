/**
 * @jest-environment node
 */

import {filterBlockedUsers, isBlocked} from '@libs/BlockUtils';
import {getCommonFriends, getCommonFriendsCount} from '@libs/FriendUtils';
import type {UserList} from '@src/types/onyx/OnyxCommon';

// The signed-in user's outbound block list, as hydrated into
// `USER_DATA_LIST[myUid].blocked` (the server writes `{[uid]: true}`).
const BLOCKED: UserList = {bob: true, carol: true};

describe('libs/BlockUtils.isBlocked', () => {
  it('returns true for a user in the block list', () => {
    expect(isBlocked(BLOCKED, 'bob')).toBe(true);
  });

  it('returns false for a user not in the block list', () => {
    expect(isBlocked(BLOCKED, 'dave')).toBe(false);
  });

  it('returns false when the block list is undefined (nobody blocked)', () => {
    expect(isBlocked(undefined, 'bob')).toBe(false);
  });

  it('returns false when the block list is empty', () => {
    expect(isBlocked({}, 'bob')).toBe(false);
  });

  it('treats a falsy entry as not blocked (e.g. a stale {uid: false})', () => {
    expect(isBlocked({bob: false}, 'bob')).toBe(false);
  });
});

describe('libs/BlockUtils.filterBlockedUsers', () => {
  it('removes blocked users while preserving order', () => {
    expect(
      filterBlockedUsers(['alice', 'bob', 'dave', 'carol'], BLOCKED),
    ).toEqual(['alice', 'dave']);
  });

  it('returns the same array reference when there is no block list', () => {
    const input = ['alice', 'bob'];
    expect(filterBlockedUsers(input, undefined)).toBe(input);
  });

  it('returns all users when none are blocked', () => {
    expect(filterBlockedUsers(['alice', 'dave'], BLOCKED)).toEqual([
      'alice',
      'dave',
    ]);
  });

  it('returns an empty array when every user is blocked', () => {
    expect(filterBlockedUsers(['bob', 'carol'], BLOCKED)).toEqual([]);
  });

  it('handles an empty input array', () => {
    expect(filterBlockedUsers([], BLOCKED)).toEqual([]);
  });
});

// FriendUtils delegates its blocked-exclusion to filterBlockedUsers; these cover
// the wiring used by ProfileScreen / FriendsFriendsScreen (#760).
describe('libs/FriendUtils common-friends blocked exclusion', () => {
  it('excludes blocked users from the common-friends list', () => {
    const mine = ['alice', 'bob', 'carol'];
    const theirs = ['bob', 'carol', 'dave'];
    expect(getCommonFriends(mine, theirs, BLOCKED)).toEqual([]);
  });

  it('keeps non-blocked common friends', () => {
    const mine = ['alice', 'bob', 'dave'];
    const theirs = ['alice', 'bob', 'erin'];
    // alice is common and not blocked; bob is common but blocked.
    expect(getCommonFriends(mine, theirs, BLOCKED)).toEqual(['alice']);
  });

  it('matches the legacy behaviour when no block list is passed', () => {
    const mine = ['alice', 'bob'];
    const theirs = ['bob', 'carol'];
    expect(getCommonFriends(mine, theirs)).toEqual(['bob']);
  });

  it('counts only non-blocked common friends', () => {
    const mine = ['alice', 'bob', 'carol'];
    const theirs = ['alice', 'bob', 'carol'];
    // alice counts; bob and carol are blocked.
    expect(getCommonFriendsCount(mine, theirs, BLOCKED)).toBe(1);
  });
});
