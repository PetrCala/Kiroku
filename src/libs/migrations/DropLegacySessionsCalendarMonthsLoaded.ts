import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import Log from '@libs/Log';

/**
 * The home-calendar scroll depth used to live under a single Onyx key
 * (`SESSIONS_CALENDAR_MONTHS_LOADED: number`). It has moved to a per-user
 * collection (`COLLECTION.SESSIONS_CALENDAR_MONTHS_BY_USER_ID`) so both the
 * auth-user listener and the friend-profile fetcher can read their own UID's
 * depth.
 *
 * This migration runs before auth resolves (the `migrateOnyx` framework is a
 * pre-auth boot step), so we can't copy the legacy value into
 * `${prefix}${authUid}` — we don't know the auth UID yet. We just drop the
 * key. Cost: users who had scrolled the home calendar back several months
 * will see the default 3-month window on first launch after upgrade and
 * re-scroll once. Acceptable tradeoff for an 8-byte preference.
 */
export default function DropLegacySessionsCalendarMonthsLoaded(): Promise<void> {
  Log.info(
    '[Migrate Onyx] DropLegacySessionsCalendarMonthsLoaded: clearing legacy key',
  );
  // eslint-disable-next-line rulesdir/prefer-actions-set-data
  return Onyx.set(ONYXKEYS.SESSIONS_CALENDAR_MONTHS_LOADED, null);
}
