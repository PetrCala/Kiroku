import type {ValueOf} from 'type-fest';
import type {UserID} from './OnyxCommon';
import type {DrinksList} from './Drinks';
import type CONST from '@src/CONST';
import {SelectedTimezone} from './PersonalDetails';

type DrinkingSessionId = string;

type DrinkingSessionType = ValueOf<typeof CONST.SESSION_TYPES>;

type DrinkingSession = {
  start_time: number;
  end_time: number;
  timezone?: SelectedTimezone;
  drinks?: DrinksList;
  blackout: boolean;
  note: string;
  ongoing?: boolean;
  type: DrinkingSessionType;
  session_type?: string; // TODO: remove in 0.4.x
};

type DrinkingSessionList = Record<DrinkingSessionId, DrinkingSession>;

type DrinkingSessionArray = DrinkingSession[];

type UserDrinkingSessionsList = Record<UserID, DrinkingSessionList>;

export default DrinkingSession;
export type {
  DrinkingSessionArray,
  DrinkingSessionId,
  DrinkingSessionList,
  DrinkingSessionType,
  UserDrinkingSessionsList,
};
