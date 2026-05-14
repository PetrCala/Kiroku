import type {Database} from 'firebase/database';
import type {
  UserIDToNicknameMapping,
  UserSearchResults,
} from '@src/types/various/Search';
import type {NicknameToId} from '@src/types/onyx';
import {readDataOnce} from '@database/baseFunctions';
import {cleanStringForFirebaseKey} from './StringUtilsKiroku';

/**
 * Using a database object and a nickname to search,
 * fetch the user IDs that belong to that nickname.
 * Return this object if it exists, or an empty object
 * if not.
 *
 * @param db Firebase Database object.
 * @param searchText The nickname to search for.
 * @returns The user IDs
 *  that belong to this nickname
 */
async function searchDbByNickname(
  db: Database,
  searchText: string,
): Promise<NicknameToId | null> {
  const nicknameKey = cleanStringForFirebaseKey(searchText);
  return readDataOnce<NicknameToId>(db, `nickname_to_id/${nicknameKey}`);
}

/**
 * Searches the database for a given searchText and returns a string of IDs that match the search text.
 * @param db - The database object.
 * @param searchText - The text to search for.
 * @returns A Promise that resolves to a string of IDs that match the search text.
 */
async function searchDatabaseForUsers(
  db: Database | undefined,
  searchText: string,
): Promise<UserSearchResults> {
  if (!searchText || !db) {
    return [];
  }
  let searchResultData: UserSearchResults = [];
  const newResults = await searchDbByNickname(db, searchText); // Nickname is cleaned in the function
  if (newResults) {
    searchResultData = Object.keys(newResults);
  }
  return searchResultData;
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
