import type {UserID} from '@src/types/onyx/OnyxCommon';
import DBPATHS from '@src/DBPATHS';
import type {FetchDataKey} from './types';

/** Given a database base key, fetch the full route to the database node
 * for a specific user.
 */
function fetchDataKeyToDbPath(key: FetchDataKey, userID?: UserID) {
  const id = userID ?? '-1';

  let path;
  switch (key) {
    case 'config':
      path = DBPATHS.CONFIG;
      break;
    case 'userStatusData':
      path = DBPATHS.USER_STATUS_USER_ID.getRoute(id);
      break;
    case 'drinkingSessionData':
      path = DBPATHS.USER_DRINKING_SESSIONS_USER_ID.getRoute(id);
      break;
    case 'preferences':
      path = DBPATHS.USER_PREFERENCES_USER_ID.getRoute(id);
      break;
    case 'unconfirmedDays':
      path = DBPATHS.USER_UNCONFIRMED_DAYS_USER_ID.getRoute(id);
      break;
    case 'userData':
      path = DBPATHS.USERS_USER_ID.getRoute(id);
      break;
    case 'dataVisibility':
      path = DBPATHS.USER_DATA_VISIBILITY_USER_ID.getRoute(id);
      break;
    default:
      break;
  }
  if (path) {
    return path;
  }
  return null;
}

export {
  // eslint-disable-next-line import/prefer-default-export
  fetchDataKeyToDbPath,
};
