import type CONST from '@src/CONST';
import type DeepValueOf from '@src/types/utils/DeepValueOf';
import type {Timestamp, UserID} from './OnyxCommon';
import type {DrinksList} from './Drinks';
import type {SelectedTimezone} from './UserData';

/** Options denoting how drinks should be added to an object of drinks */
type AddDrinksOptions =
  | {
      /** An option for when drinks should be added under the current timestamp */
      timestampOption: 'now';
    }
  | {
      /** An option for when drinks should be added to the session start time */
      timestampOption: 'sessionStartTime';

      /** The start time of the session to which the drinks should be added to */
      start_time: Timestamp;
    }
  | {
      /** An option for when drinks should be added to the session end time */
      timestampOption: 'sessionEndTime';

      /** The end time of the session to which the drinks should be added to */
      end_time: number;
    };

/** Options denoting how drinks should be removed */
type RemoveDrinksOptions = 'removeFromLatest' | 'removeFromEarliest';

/** A drinking session unique identifier */
type DrinkingSessionId = string;

/** A drinking session type */
type DrinkingSessionType = DeepValueOf<typeof CONST.SESSION.TYPES>;

/** A model for a drinking session */
type DrinkingSession = {
  /** A unique identifier of the drinking session, used only locally */
  id?: DrinkingSessionId;

  /** A UNIX timestamp representing the start time of the session */
  start_time: Timestamp;

  /** A UNIX timestamp representing the end time of the session */
  end_time?: Timestamp;

  /** The timezone where this session took place */
  timezone?: SelectedTimezone;

  /** The drinks recorded during the session */
  drinks?: DrinksList;

  /** Whether or not the user had a blackout during the session */
  blackout?: boolean;

  /** A private note */
  note?: string;

  /** Whether or not the session is still going on */
  ongoing?: boolean;

  /** The type of this session */
  type?: DrinkingSessionType;
};

/** A collection of drinking sessions */
type DrinkingSessionList = Record<DrinkingSessionId, DrinkingSession>;

/** An array of drinking sessions */
type DrinkingSessionArray = DrinkingSession[];

/** A collection of drinking sessions of multiple users */
type UserDrinkingSessionsList = Record<UserID, DrinkingSessionList>;

export default DrinkingSession;
export type {
  AddDrinksOptions,
  DrinkingSessionArray,
  DrinkingSessionId,
  DrinkingSessionList,
  DrinkingSessionType,
  RemoveDrinksOptions,
  UserDrinkingSessionsList,
};
