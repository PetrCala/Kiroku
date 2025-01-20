import {rand, randTimeZone, randBoolean, randText} from '@ngneat/falso';
import CONST from '@src/CONST';
import type {DrinkingSession, DrinkingSessionType} from '@src/types/onyx';
import type {Timestamp} from '@src/types/onyx/OnyxCommon';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import {randDrinksList} from './drinks';
import createCollection from './createCollection';
import {getRandomTimestamp} from './timestamp';

export default function randDrinkingSession(
  index: Timestamp,
  type?: DrinkingSessionType,
): DrinkingSession {
  const startTime = index;
  const endTime = getRandomTimestamp(startTime, new Date().getTime()); // between start and now
  const sessionType = type ?? rand(Object.values(CONST.SESSION.TYPES));
  const isRealtime = Object.values(
    CONST.SESSION.REALTIME.some(x => x === sessionType),
  );

  return {
    id: index.toString(),
    ...(isRealtime
      ? {
          ongoing: true,
        }
      : {
          end_time: endTime,
        }),
    start_time: startTime,
    drinks: randDrinksList({from: startTime}),
    blackout: randBoolean(),
    note: randText(),
    timezone: randTimeZone() as SelectedTimezone,
    type: sessionType,
  };
}

const randDrinkingSessionList = (length = 500) =>
  createCollection<DrinkingSession>(
    item => item.id ?? '',
    index => randDrinkingSession(index),
    length,
  );

export {randDrinkingSession, randDrinkingSessionList};
