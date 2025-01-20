import {
  rand,
  randNumber,
  randTimeZone,
  randBoolean,
  randText,
  randPastDate,
} from '@ngneat/falso';
import CONST from '@src/CONST';
import {addMilliseconds} from 'date-fns';
import type {DrinkingSession, DrinkingSessionList} from '@src/types/onyx';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import {randDrinksList} from './drinks';
import createCollection from './createCollection';

export default function randDrinkingSession(
  index: number,
  isOngoing?: boolean,
): DrinkingSession {
  const startTime = randPastDate().getTime();
  const endTime = addMilliseconds(
    startTime,
    randNumber({min: 0, max: 8 * 60 * 60 * 1000}), // Up to 8 hours
  ).getTime();
  const sessionType = isOngoing
    ? CONST.SESSION.TYPES.LIVE
    : rand(Object.values(CONST.SESSION.TYPES));

  return {
    id: startTime.toString(),
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
