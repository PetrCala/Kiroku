import * as DrinkingSession from '@libs/actions/DrinkingSession';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DrinkingSessionList} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import {startOfMonth, subMonths} from 'date-fns';
import {useEffect, useRef, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import useNetwork from '@hooks/useNetwork';
import StatsPerf from '@libs/StatsPerf';

type UseDrinkingSessionsFetchReturn = {
  /** Last-good snapshot of the windowed session list. Stays populated across
   *  widen re-fetches so the calendar doesn't blank out during the round trip.
   *  `undefined` once the server denies/evicts access (see below). */
  data: DrinkingSessionList | undefined;
  /** True only on the initial fetch — later widens swap `data` on resolve
   *  without flipping this back to true. Consumers should NOT show a full
   *  loading state on widens. */
  isLoading: boolean;
  /** True while a wider-window re-fetch is in flight (user scrolled the
   *  calendar past the loaded edge). Cleared when the read resolves. */
  isFetchingOlderMonths: boolean;
};

/**
 * Windowed read of a target user's drinking sessions through the
 * privacy-enforced `GET /v1/users/:uid/sessions` API — previously a direct
 * Firebase RTDB `get()` of `user_drinking_sessions/$uid`.
 *
 * The server windows by `start_time` to the most recent
 * `CONST.SESSIONS_INITIAL_FETCH_MONTHS` months (or wider if the calendar has
 * scrolled back, persisted per-UID in
 * `${COLLECTION.SESSIONS_CALENDAR_MONTHS_BY_USER_ID}${userID}`) AND enforces the
 * friends + visibility check that used to live only in the RTDB security rules
 * (which the admin SDK bypasses). The windowed map is delivered as onyxData into
 * `cachedDrinkingSessions[userID]`, which this hook reads back via Onyx.
 *
 * When the server denies/hides the data it evicts that key (Kiroku #786), so
 * `data` becomes `undefined` the instant a viewer loses access — the UI can no
 * longer show sessions it cached while previously allowed.
 *
 * When the calendar widens (via [[useLazyMarkedDates.loadMoreMonths]]) the Onyx
 * depth bumps and this hook re-issues the read with an earlier `from`. A request
 * token guards the loading flags so a stale in-flight widen does not clear them
 * early. An empty `userID` (the self branch of screens that show both) is a
 * no-op.
 */
function useDrinkingSessionsFetch(
  userID: UserID,
): UseDrinkingSessionsFetchReturn {
  const [monthsLoaded, monthsLoadedMeta] = useOnyx(
    `${ONYXKEYS.COLLECTION.SESSIONS_CALENDAR_MONTHS_BY_USER_ID}${userID}`,
  );
  // The API delivers the windowed sessions into cachedDrinkingSessions[userID];
  // reading them back here means eviction-on-deny (#786) flows straight to the
  // UI without any local bookkeeping.
  const [cachedDrinkingSessions] = useOnyx(ONYXKEYS.CACHED_DRINKING_SESSIONS);
  const data = userID ? cachedDrinkingSessions?.[userID] : undefined;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFetchingOlderMonths, setIsFetchingOlderMonths] =
    useState<boolean>(false);
  const prevSessionsMonthsBackRef = useRef<number | null>(null);

  // Latest-wins request token. Bumped before each fetch; on resolve we ignore
  // the result unless its token still matches `currentTokenRef.current`, so a
  // stale wider/narrower round-trip can't clear the loading flags out of turn.
  const currentTokenRef = useRef(0);
  const hasResolvedInitialRef = useRef(false);

  const sessionsMonthsBack = Math.max(
    CONST.SESSIONS_INITIAL_FETCH_MONTHS,
    monthsLoaded ?? 0,
  );

  useEffect(() => {
    // Skip until prerequisites are in place. `isLoading` stays `true` —
    // ProfileScreen mounts after auth so `userID` is always set in practice,
    // and Onyx hydration is fast. Wait for the saved depth to hydrate so we
    // don't fetch the default 3 months and then immediately re-fetch wider.
    if (!userID || monthsLoadedMeta.status !== 'loaded') {
      // DIAGNOSTIC: the fetch is gated. For a friend, a stuck `monthsMeta` here
      // (never 'loaded') would keep `isLoading` true forever → stuck skeleton.
      StatsPerf.note(
        `fetch skip uid=${userID || '(self)'} monthsMeta=${monthsLoadedMeta.status}`,
      );
      return;
    }

    StatsPerf.note(`fetch run uid=${userID} monthsBack=${sessionsMonthsBack}`);
    const token = ++currentTokenRef.current;
    const prev = prevSessionsMonthsBackRef.current;
    const isWiden = prev !== null && sessionsMonthsBack > prev;
    prevSessionsMonthsBackRef.current = sessionsMonthsBack;
    if (isWiden) {
      setIsFetchingOlderMonths(true);
    }
    // Snap to the start of the earliest visible month so every month inside the
    // fetched window is loaded in full — without this, a sliding window that
    // stops mid-month would leave the early days unfetched and misrender them as
    // "before tracking started". Matches the server's `start_time >= from`.
    const from = startOfMonth(
      subMonths(new Date(), sessionsMonthsBack),
    ).getTime();

    const finalize = () => {
      StatsPerf.note(
        `fetch resolved uid=${userID} stale=${token !== currentTokenRef.current}`,
      );
      if (token !== currentTokenRef.current) {
        return;
      }
      if (!hasResolvedInitialRef.current) {
        hasResolvedInitialRef.current = true;
        setIsLoading(false);
      }
      setIsFetchingOlderMonths(false);
    };

    // A block-gated / privacy-denied read rejects with a non-2xx (it bypasses
    // SaveResponseInOnyx, so failureData never runs). Swallow it: the calendar
    // should resolve to a clean empty state (the server evicts the cached key on
    // deny — #786), never throw an unhandled rejection. `finalize` still clears
    // the loading flags either way.
    DrinkingSession.openFriendDrinkingSessions(userID, from)
      .catch(() => undefined)
      .finally(finalize);
  }, [userID, sessionsMonthsBack, monthsLoadedMeta.status]);

  // Re-issue the windowed read when connectivity resumes.
  // `openFriendDrinkingSessions` goes through `makeRequestWithSideEffects`,
  // which DISCARDS a read while offline instead of queueing it (unlike
  // `API.write`), and the effect above only re-runs when `userID` /
  // `sessionsMonthsBack` change — so an offline mount leaves the calendar empty
  // even after going back online. Re-fetch the SAME window (no token/loading
  // bookkeeping needed: the carry-no-optimistic-data read just refreshes
  // `cachedDrinkingSessions[userID]` in place when it lands).
  useNetwork({
    onReconnect: () => {
      if (!userID || monthsLoadedMeta.status !== 'loaded') {
        return;
      }
      const from = startOfMonth(
        subMonths(new Date(), sessionsMonthsBack),
      ).getTime();
      // Swallow a block-gated / privacy-denied rejection here too (see above).
      DrinkingSession.openFriendDrinkingSessions(userID, from).catch(
        () => undefined,
      );
    },
  });

  return {data, isLoading, isFetchingOlderMonths};
}

export default useDrinkingSessionsFetch;
