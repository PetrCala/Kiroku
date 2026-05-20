import type Config from './Config';
import type {FeedbackList} from './Feedback';
import type {NicknameToIdList} from './NicknameToId';
import type {PreferencesList} from './Preferences';
import type {UnconfirmedDaysList} from './UnconfirmedDays';
import type {UserDataList} from './UserData';
import type {UserDrinkingSessionsList} from './DrinkingSession';
import type {UserStatusList} from './UserStatus';
import type {SessionPlaceholderList} from './SessionPlaceholder';
import type {ReasonForLeavingList} from './ReasonForLeaving';
import type {BugList} from './Bug';

/** Main database props object
 *
 * Not named "Database" to avoid confusion with the Firebase database object.
 */
type DatabaseProps = {
  /** A bug collection */
  bugs: BugList;

  /** An object containing the global application configuration */
  config: Config;

  /** A feedback collection */
  feedback: FeedbackList;

  /** A collection of nickname to user ID mappings */
  nickname_to_id: NicknameToIdList;

  /** A collection of the reasons for users' leaving */
  reasons_for_leaving: ReasonForLeavingList;

  /** A collection of all drinking sessions */
  user_drinking_sessions: UserDrinkingSessionsList;

  /** A collection of all user preferences */
  user_preferences: PreferencesList;

  /** A collection of all user session placeholders */
  user_session_placeholder: SessionPlaceholderList;

  /** A collection of all user status data */
  user_status: UserStatusList;

  /** A collection of all user unconfirmed days */
  user_unconfirmed_days: UnconfirmedDaysList;

  /** A collection of all users' data */
  users: UserDataList;
};

export default DatabaseProps;
