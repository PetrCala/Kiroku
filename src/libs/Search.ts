import type {UserIDToNicknameMapping} from '@src/types/various/Search';
import {cleanStringForFirebaseKey} from './StringUtilsKiroku';

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

export {getNicknameMapping, searchArrayByText};
