import type {Database} from 'firebase/database';
import {endAt, get, orderByKey, query, ref, startAt} from 'firebase/database';
import type {
  UserIDToNicknameMapping,
  UserSearchResults,
} from '@src/types/various/Search';
import type {NicknameToIdList} from '@src/types/onyx';
import CONST from '@src/CONST';
import {cleanStringForFirebaseKey} from './StringUtilsKiroku';

/**
 * Using a database object and a search prefix, fetch every `nickname_to_id`
 * bucket whose normalized name-key starts with that prefix (e.g. "john"
 * matches "john_doe", "johnny", ...). Returns the matching buckets keyed by
 * name-key, or `null` when the prefix is too short or nothing matches.
 *
 * The prefix range query relies on the standard Firebase key-ordering idiom:
 * keys in `[prefix, prefix + '\uf8ff']` are exactly those starting with
 * `prefix`, since `\uf8ff` is a very high code point that sorts after any
 * realistic key suffix.
 *
 * @param db Firebase Database object.
 * @param searchText The nickname prefix to search for.
 * @returns The matching name-key buckets, or null.
 */
async function searchDbByNickname(
  db: Database,
  searchText: string,
): Promise<NicknameToIdList | null> {
  const prefix = cleanStringForFirebaseKey(searchText);
  // `cleanStringForFirebaseKey` collapses empty/invalid input to '_'. Guard
  // both that sentinel and overly short prefixes to avoid scanning the table.
  if (
    prefix === '_' ||
    prefix.length < CONST.SEARCH.MIN_NICKNAME_PREFIX_LENGTH
  ) {
    return null;
  }
  const nicknameQuery = query(
    ref(db, 'nickname_to_id'),
    orderByKey(),
    startAt(prefix),
    endAt(`${prefix}\uf8ff`),
  );
  const snapshot = await get(nicknameQuery);
  if (snapshot.exists()) {
    return snapshot.val() as NicknameToIdList;
  }
  return null;
}

/**
 * Searches the database for a given searchText and returns the deduplicated
 * list of user IDs whose normalized display name starts with it.
 * @param db - The database object.
 * @param searchText - The text to search for.
 * @returns A Promise that resolves to the matching user IDs.
 */
async function searchDatabaseForUsers(
  db: Database | undefined,
  searchText: string,
): Promise<UserSearchResults> {
  if (!searchText || !db) {
    return [];
  }
  const buckets = await searchDbByNickname(db, searchText); // Prefix is cleaned in the function
  if (!buckets) {
    return [];
  }
  // Each bucket is a {userID: nickname} map; flatten and dedupe across buckets.
  const userIDs = new Set<string>();
  Object.values(buckets).forEach(bucket => {
    Object.keys(bucket).forEach(userID => userIDs.add(userID));
  });
  return Array.from(userIDs);
}

function searchItemIsRelevant(
  item: string,
  cleanedText: string,
  mapping: UserIDToNicknameMapping,
): boolean {
  const mappingText = mapping[item];
  if (mappingText) {
    const cleanedMappingText = cleanStringForFirebaseKey(mappingText);
    return cleanedMappingText.includes(cleanedText);
  }
  return false;
}

function searchArrayByText(
  arr: string[],
  searchText: string,
  mapping: UserIDToNicknameMapping,
): string[] {
  if (!searchText) {
    return arr;
  }
  const cleanedSearchText = cleanStringForFirebaseKey(searchText);
  return arr.filter(item =>
    searchItemIsRelevant(item, cleanedSearchText, mapping),
  );
}

/**
 * Input an object where the keys are userIDs, and the first level
 * of the object contains the display name of the user
 *
 * @param object - The input object containing user data
 * @param displayNameKey - The key to access the display name of the user, defaults to "display_name"
 * @returns A mapping of user ids to nicknames
 */
function getNicknameMapping(
  object: Record<string, Record<string, unknown>>,
  displayNameKey = 'display_name',
): UserIDToNicknameMapping {
  const mapping: UserIDToNicknameMapping = Object.fromEntries(
    Object.entries(object).map(([userID, user]) => [
      userID,
      String(user[displayNameKey] ?? ''),
    ]),
  );

  return mapping;
}

export {
  getNicknameMapping,
  searchDbByNickname,
  searchDatabaseForUsers,
  searchArrayByText,
};
