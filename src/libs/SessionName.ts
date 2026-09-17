import {formatInTimeZone} from 'date-fns-tz';
import DateUtils from '@libs/DateUtils';
import * as Localize from '@libs/Localize';
import BaseLocaleListener from '@libs/Localize/LocaleListener/BaseLocaleListener';
import CONST from '@src/CONST';
import type Locale from '@src/types/onyx/Locale';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/** The part of the day a local hour (0 to 23) falls into. */
function getPartOfDay(hour: number): PartOfDay {
  const start = CONST.SESSION.PART_OF_DAY_START;
  if (hour >= start.NIGHT || hour < start.MORNING) {
    return 'night';
  }
  if (hour < start.AFTERNOON) {
    return 'morning';
  }
  if (hour < start.EVENING) {
    return 'afternoon';
  }
  return 'evening';
}

/**
 * The name a new session gets before the user renames it (RFC §9): the
 * weekday and the part of the day it started in, in the session's timezone,
 * localized, e.g. "Friday evening" or "Páteční večer". The first letter is
 * capitalized so the name reads as a title in every language.
 */
function getDefaultSessionName(
  startTime: number,
  timezone: SelectedTimezone | undefined,
  locale: Locale = BaseLocaleListener.getPreferredLocale(),
): string {
  const tz = timezone ?? CONST.DEFAULT_TIME_ZONE.selected;
  const dateFnsLocale = DateUtils.getDateFnsLocale(locale);
  const weekday = formatInTimeZone(startTime, tz, 'EEEE', {
    locale: dateFnsLocale,
  });
  // ISO day of week runs Monday 1 to Sunday 7; the translations index Sunday
  // first.
  const weekdayIndex = Number(formatInTimeZone(startTime, tz, 'i')) % 7;
  const hour = Number(formatInTimeZone(startTime, tz, 'H'));
  const partOfDay = Localize.translate(
    locale,
    `drinkingSession.partOfDay.${getPartOfDay(hour)}`,
  );
  const name = Localize.translate(locale, 'drinkingSession.defaultName', {
    weekday,
    weekdayIndex,
    partOfDay,
  });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export {getDefaultSessionName, getPartOfDay};
export type {PartOfDay};
