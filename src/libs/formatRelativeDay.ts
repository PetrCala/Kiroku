import type {LocaleContextProps} from '@components/LocaleContextProvider';
import getRelativeDayTier from './getRelativeDayTier';
import type {RelativeDayTier} from './getRelativeDayTier';

type Translate = LocaleContextProps['translate'];

/**
 * Day-granularity relative copy for a past date: "Today", "Yesterday",
 * "3 days ago", "2 months ago", "1 year ago". Rounded to whole days and never
 * hours, escalating to months and years only once a full one has elapsed (see
 * `getRelativeDayTier`). Shared by the last-session banner and the feed cards
 * so the two never disagree about the same session.
 */
function formatRelativeDayTier(tier: RelativeDayTier, translate: Translate) {
  switch (tier.unit) {
    case 'years':
      return translate('homeScreen.banners.lastSession.yearsAgo', {
        count: tier.count,
      });
    case 'months':
      return translate('homeScreen.banners.lastSession.monthsAgo', {
        count: tier.count,
      });
    case 'days':
      return translate('homeScreen.banners.lastSession.daysAgo', {
        count: tier.count,
      });
    case 'yesterday':
      return translate('homeScreen.banners.lastSession.yesterday');
    case 'today':
    default:
      return translate('homeScreen.banners.lastSession.today');
  }
}

/** `formatRelativeDayTier` for a timestamp, measured against `now`. */
function formatRelativeDay(
  timestamp: number,
  now: Date,
  translate: Translate,
): string {
  return formatRelativeDayTier(
    getRelativeDayTier(new Date(timestamp), now),
    translate,
  );
}

export {formatRelativeDay, formatRelativeDayTier};
