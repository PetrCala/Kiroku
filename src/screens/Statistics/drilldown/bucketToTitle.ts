import {format, parseISO} from 'date-fns';
import type useLocalize from '@hooks/useLocalize';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {TranslationPaths} from '@src/languages/types';
import type {BucketDescriptor} from './types';

type Translate = ReturnType<typeof useLocalize>['translate'];

const DRINK_LABEL_KEY: Readonly<Record<DrinkKey, TranslationPaths>> = {
  small_beer: 'drinks.smallBeer',
  beer: 'drinks.beer',
  wine: 'drinks.wine',
  weak_shot: 'drinks.weakShot',
  strong_shot: 'drinks.strongShot',
  cocktail: 'drinks.cocktail',
  other: 'drinks.other',
};

function formatHour(hour: number): string {
  if (hour === 0) {
    return '12 AM';
  }
  if (hour === 12) {
    return '12 PM';
  }
  if (hour < 12) {
    return `${hour} AM`;
  }
  return `${hour - 12} PM`;
}

function formatDay(dateKey: string): string {
  try {
    return format(parseISO(dateKey), 'PP');
  } catch {
    return dateKey;
  }
}

function formatMonth(monthKey: string): string {
  try {
    return format(parseISO(`${monthKey}-01`), 'MMMM yyyy');
  } catch {
    return monthKey;
  }
}

function formatSessionDrinkCountBin(
  min: number,
  max: number | undefined,
): string {
  if (max === undefined) {
    return `${min}+ drinks`;
  }
  // Bins are half-open [min, max) so 1..2 means exactly 1.
  if (max - min === 1) {
    return `${min} drink${min === 1 ? '' : 's'}`;
  }
  return `${min}–${max - 1} drinks`;
}

function formatSessionDurationBin(
  minMin: number,
  maxMin: number | undefined,
): string {
  const fmt = (m: number) =>
    m < 60 ? `${Math.round(m)}m` : `${Math.round((m / 60) * 10) / 10}h`;
  if (maxMin === undefined) {
    return `${fmt(minMin)}+`;
  }
  return `${fmt(minMin)}–${fmt(maxMin)}`;
}

/**
 * Produces the human-readable title for a drill-down sheet's bucket. Pure —
 * depends only on its inputs. The `translate` argument is the bound function
 * from `useLocalize()` so the sheet can stay in JSX-land and the helper stays
 * trivial to test.
 */
function bucketToTitle(bucket: BucketDescriptor, translate: Translate): string {
  switch (bucket.kind) {
    case 'day':
      return translate('statistics.drilldown.title.day', {
        label: formatDay(bucket.date),
      });
    case 'isoWeek':
      return translate('statistics.drilldown.title.isoWeek', {
        label: bucket.isoWeek,
      });
    case 'month':
      return translate('statistics.drilldown.title.month', {
        label: formatMonth(bucket.month),
      });
    case 'hour':
      return translate('statistics.drilldown.title.hour', {
        label: formatHour(bucket.hour),
      });
    case 'dow':
      // dow/dowHour kinds aren't wired in v2-K. Rotated 0..6 needs the
      // user's week-start to render as a weekday name — defer until a chart
      // actually emits this bucket.
      return translate('statistics.drilldown.title.dow', {
        label: `Day ${bucket.dow + 1}`,
      });
    case 'dowHour':
      return translate('statistics.drilldown.title.dowHour', {
        label: `Day ${bucket.dow + 1} at ${formatHour(bucket.hour)}`,
      });
    case 'drinkType':
      return translate('statistics.drilldown.title.drinkType', {
        label: translate(DRINK_LABEL_KEY[bucket.drinkKey]),
      });
    case 'isoWeekDrinkType':
      return translate('statistics.drilldown.title.isoWeekDrinkType', {
        label: `${translate(DRINK_LABEL_KEY[bucket.drinkKey])} — ${bucket.isoWeek}`,
      });
    case 'sessionDrinkCountBin':
      return translate('statistics.drilldown.title.sessionDrinkCountBin', {
        label: formatSessionDrinkCountBin(bucket.minDrinks, bucket.maxDrinks),
      });
    case 'sessionDurationBin':
      return translate('statistics.drilldown.title.sessionDurationBin', {
        label: formatSessionDurationBin(bucket.minMinutes, bucket.maxMinutes),
      });
    default:
      return '';
  }
}

export default bucketToTitle;
