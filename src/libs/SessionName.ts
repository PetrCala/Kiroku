import {formatInTimeZone} from 'date-fns-tz';
import DateUtils from '@libs/DateUtils';
import * as Localize from '@libs/Localize';
import BaseLocaleListener from '@libs/Localize/LocaleListener/BaseLocaleListener';
import CONST from '@src/CONST';
import type {DrinkingSession} from '@src/types/onyx';
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

/**
 * The name to show for a session. A session started since Sessions v2 carries
 * its own `name`; a legacy one (and a v2 session the backfill or the watch
 * created without a name, RFC §15) falls back to the generated default for its
 * start time and timezone, so every session reads as named everywhere it is
 * listed. A name the user blanked out falls back too.
 */
function getSessionDisplayName(
  session: DrinkingSession | undefined,
  locale: Locale = BaseLocaleListener.getPreferredLocale(),
): string {
  const stored = session?.name?.trim();
  if (stored) {
    return stored;
  }
  if (!session) {
    return '';
  }
  return getDefaultSessionName(session.start_time, session.timezone, locale);
}

export {getDefaultSessionName, getSessionDisplayName, getPartOfDay};
export type {PartOfDay};
