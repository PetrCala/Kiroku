import * as API from '@libs/API';
import type {OpenSessionsPageParams} from '@libs/API/parameters';
import {READ_COMMANDS} from '@libs/API/types';
import CONST from '@src/CONST';
import type {SessionsPage} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';

/**
 * One page of a user's session history for the Home feed (RFC §10): the
 * `limit` newest sessions started strictly before `before`, or the newest
 * ones when `before` is omitted.
 *
 * A read, so it goes through `makeRequestWithSideEffects`: the sessions ride
 * in as an Onyx merge under `cachedDrinkingSessions[userID]` (the same map the
 * app-open snapshot and the calendar's month windows fill), and the pagination
 * state comes back as a `sessionsPage` sidecar for the caller to keep. While
 * offline the read is discarded rather than queued, and this resolves with
 * `undefined`, so the caller must not mark the history as finished on it.
 */
async function fetchSessionsPage(
  userID: UserID,
  before: number | undefined,
  limit: number = CONST.SESSION_FEED_PAGE_SIZE,
): Promise<SessionsPage | undefined> {
  const parameters: OpenSessionsPageParams = {userID, limit, before};
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  const response = await API.makeRequestWithSideEffects(
    READ_COMMANDS.OPEN_SESSIONS_PAGE,
    parameters,
    {},
    CONST.API_REQUEST_TYPE.READ,
  );
  return response?.sessionsPage;
}

export default fetchSessionsPage;
