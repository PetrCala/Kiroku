import {rand, randTimeZone, randBoolean, randText} from '@ngneat/falso';
import CONST from '@src/CONST';
import type {DrinkingSession, DrinkingSessionList} from '@src/types/onyx';
import type {Timestamp} from '@src/types/onyx/OnyxCommon';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import {randDrinksList} from './drinks';
import createCollection from './createCollection';
import {getRandomTimestamp} from './timestamp';

export default function randDrinkingSession(
  index: Timestamp,
  isOngoing?: boolean,
): DrinkingSession {
  const startTime = index;
  const endTime = getRandomTimestamp(startTime, new Date().getTime()); // between start and now
  const sessionType = isOngoing
    ? CONST.SESSION.TYPES.LIVE
    : rand(Object.values(CONST.SESSION.TYPES));

  return {
    id: index.toString(),
    ...(isOngoing
      ? {
          ongoing: true,
        }
      : {
          end_time: endTime,
        }),
    start_time: startTime,
    drinks: randDrinksList({from: startTime, length: rand([1, 3, 5])}),
    blackout: randBoolean(),
    note: randText(),
    timezone: randTimeZone() as SelectedTimezone,
    type: sessionType,
  };
}

type RandDrinkingSessionListParams = {
  /** Number of sessions to create */
  length?: number;

  /** Whether one of the sessions should be ongoing */
  shouldIncludeOngoing?: boolean;
};

const randDrinkingSessionList = ({
  length = 500,
  shouldIncludeOngoing = false,
}: RandDrinkingSessionListParams): DrinkingSessionList => {
  if (length <= 0) {
    return {};
  }

  const ongoingIndex = shouldIncludeOngoing
    ? Math.floor(Math.random() * length)
    : -1;

  return createCollection<DrinkingSession>(
    item => item.id ?? '',
    index => {
      if (shouldIncludeOngoing && index === ongoingIndex) {
        return randDrinkingSession(index, true);
      }
      return randDrinkingSession(index);
    },
    length,
  );
};

export {randDrinkingSession, randDrinkingSessionList};
