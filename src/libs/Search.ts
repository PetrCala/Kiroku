import type {Database} from 'firebase/database';
import {
  endAt,
  get,
  limitToFirst,
  orderByKey,
  query,
  ref,
  startAt,
} from 'firebase/database';
import type {
  UserIDToNicknameMapping,
  UserSearchResults,
} from '@src/types/various/Search';
import type {NicknameToId, NicknameToIdList} from '@src/types/onyx';
import CONST from '@src/CONST';
import DBPATHS from '@src/DBPATHS';
import {isEmptyArray} from '@src/types/utils/EmptyObject';
import {
  cleanStringForFirebaseKey,
  getNicknameWordKeys,
} from './StringUtilsKiroku';

// Unicode high code point used as the inclusive upper bound of a key prefix
// range query, so `startAt(prefix)`/`endAt(prefix + SUFFIX)` matches every key
// that begins with `prefix` ( sorts after any realistic key suffix).
const PREFIX_RANGE_SUFFIX = '';

/**
 * Fetch every user stored under a name word-token key that begins with the
 * given prefix (e.g. "doe" matches "doe", "doering", ...). The `nickname_to_id`
 * index is keyed by name word-tokens, each mapping to a `{userID: displayName}`
 * object, so the matched buckets are flattened into a single mapping.
 *
 * @param db Firebase Database object.
 * @param prefix The cleaned token prefix to search for.
 * @returns A mapping of matching user IDs to their stored display names.
 */
async function searchDbByPrefix(
  db: Database,
  prefix: string,
): Promise<NicknameToId> {
  const indexRef = query(
    ref(db, DBPATHS.NICKNAME_TO_ID),
    orderByKey(),
    startAt(prefix),
    endAt(`${prefix}${PREFIX_RANGE_SUFFIX}`),
    limitToFirst(CONST.SEARCH.NICKNAME_MAX_RESULTS),
  );
  const snapshot = await get(indexRef);
  if (!snapshot.exists()) {
    return {};
  }
  const buckets = snapshot.val() as NicknameToIdList;
  const merged: NicknameToId = {};
  Object.values(buckets).forEach(bucket => {
    Object.assign(merged, bucket);
  });
  return merged;
}

/**
 * Search the database for users whose name matches the given text.
 *
 * The query is split into word tokens; the most selective (longest) token
 * drives a single prefix range query, and for multi-word queries the candidate
 * set is refined client-side so every query word must appear in the user's
 * name (order-independent AND matching).
 *
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
  const wordTokens = getNicknameWordKeys(searchText).filter(
    token => token.length >= CONST.SEARCH.MIN_NICKNAME_PREFIX_LENGTH,
  );
  if (isEmptyArray(wordTokens)) {
    return [];
  }
  const driver = wordTokens.reduce((longest, token) =>
    token.length > longest.length ? token : longest,
  );
  const candidates = await searchDbByPrefix(db, driver);
  let userIDs = Object.keys(candidates);
  if (wordTokens.length > 1) {
    wordTokens.forEach(token => {
      userIDs = searchArrayByText(userIDs, token, candidates);
    });
  }
  return userIDs;
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
  searchDbByPrefix,
  searchDatabaseForUsers,
  searchArrayByText,
};
