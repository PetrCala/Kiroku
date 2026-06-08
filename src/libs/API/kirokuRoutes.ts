import type {RequestType} from '@src/types/onyx/Request';
import {
  READ_COMMANDS,
  SIDE_EFFECT_REQUEST_COMMANDS,
  WRITE_COMMANDS,
} from './types';

/**
 * kiroku-api is a per-route REST surface (e.g. `GET /v1/app/open`,
 * `POST /v1/friends/request`), unlike the legacy Expensify-style single endpoint
 * (`{root}api/{Command}`). This map translates a command name to its
 * `{method, path}` on kiroku-api. Commands NOT listed here fall through to the
 * legacy request path in `HttpUtils.xhr`. Add an entry as each action is cut over.
 */
type KirokuRoute = {
  /** HTTP method to use against kiroku-api. */
  method: RequestType;
  /** Path under the kiroku-api root, including the `/v1` prefix. */
  path: string;
  /** Optional builder for a GET route's query params, derived from request data. */
  toQuery?: (data: Record<string, unknown>) => Record<string, string | number>;
  /**
   * Optional builder for a path with URL params (e.g. `/v1/feedback/:id/remove`),
   * derived from request data. Overrides `path` when present.
   */
  toPath?: (data: Record<string, unknown>) => string;
};

const KIROKU_ROUTES: Record<string, KirokuRoute> = {
  [WRITE_COMMANDS.OPEN_APP]: {
    method: 'get',
    path: '/v1/app/open',
  },
  // Reconnect re-hydrates full state + the lastUpdateID baseline, same as open.
  [WRITE_COMMANDS.RECONNECT_APP]: {
    method: 'get',
    path: '/v1/app/open',
  },
  // Friend drinking sessions, windowed by start_time and privacy-enforced
  // server-side (friends + visibility). Denied reads return 200 with an
  // eviction patch (cachedDrinkingSessions[uid] -> null), see Kiroku #786.
  [READ_COMMANDS.OPEN_FRIEND_DRINKING_SESSIONS]: {
    method: 'get',
    path: '/v1/users/:uid/sessions',
    toPath: data =>
      `/v1/users/${encodeURIComponent(String(data.userID))}/sessions`,
    toQuery: data => ({from: Number(data.from ?? 0)}),
  },
  // Public profile read (profile + public_data + public is_supporter flag). Any
  // authenticated user may read it (mirrors the rules' `users/$uid/profile`).
  [READ_COMMANDS.OPEN_PUBLIC_PROFILE_PAGE]: {
    method: 'get',
    path: '/v1/users/:uid/profile',
    toPath: data =>
      `/v1/users/${encodeURIComponent(String(data.userID))}/profile`,
  },
  // Friend rendering preferences (units/colors), privacy-enforced server-side
  // (friends + visibility). Denied reads evict userDataList[uid].preferences.
  [READ_COMMANDS.OPEN_FRIEND_PREFERENCES]: {
    method: 'get',
    path: '/v1/users/:uid/preferences',
    toPath: data =>
      `/v1/users/${encodeURIComponent(String(data.userID))}/preferences`,
  },
  // Friend presence + latest session, privacy-enforced (friends + visibility).
  // Denied reads evict userDataList[uid].user_status.
  [READ_COMMANDS.OPEN_FRIEND_STATUS]: {
    method: 'get',
    path: '/v1/users/:uid/status',
    toPath: data =>
      `/v1/users/${encodeURIComponent(String(data.userID))}/status`,
  },
  // Batched cross-user read: one request for up to 100 uids (callers chunk
  // above that), replacing the per-uid profile/status fan-out that tripped the
  // per-uid rate limiter. `fields` selects the projections (`profile` is public;
  // `status` is privacy-gated and simply absent for a denied/hidden user). The
  // server merges `userDataList[uid].{profile,user_status,...}` per uid, same as
  // the single-user reads. `uids` is comma-joined here and percent-encoded by
  // the HTTP layer (matches the SEARCH_USERS style — no pre-encoding).
  [READ_COMMANDS.GET_USERS_BATCH]: {
    method: 'get',
    path: '/v1/users/batch',
    toQuery: data => ({
      uids: Array.isArray(data.userIDs) ? data.userIDs.join(',') : '',
      fields: typeof data.fields === 'string' ? data.fields : 'profile,status',
    }),
  },
  // A user's friends list (public, like the profile read). Backs ProfileScreen's
  // friend / common-friend counts; merged into userDataList[uid].friends.
  [READ_COMMANDS.OPEN_FRIEND_LIST]: {
    method: 'get',
    path: '/v1/users/:uid/friends',
    toPath: data =>
      `/v1/users/${encodeURIComponent(String(data.userID))}/friends`,
  },
  [SIDE_EFFECT_REQUEST_COMMANDS.GET_MISSING_ONYX_MESSAGES]: {
    method: 'get',
    path: '/v1/updates',
    toQuery: data => ({
      from: Number(data.updateIDFrom ?? 0),
      to: Number(data.updateIDTo ?? 0),
    }),
  },
  // Friend prefix search. The server tokenizes `q` and prefix-matches the
  // `nickname_to_id` index; matches ride back in the response's `searchResults`.
  [READ_COMMANDS.SEARCH_USERS]: {
    method: 'get',
    path: '/v1/users/search',
    toQuery: data => ({q: typeof data.q === 'string' ? data.q : ''}),
  },
  [WRITE_COMMANDS.PROVISION_USER]: {
    method: 'post',
    path: '/v1/provisioning',
  },
  [WRITE_COMMANDS.CLOSE_ACCOUNT]: {
    method: 'post',
    path: '/v1/account/close',
  },
  [WRITE_COMMANDS.SEND_FRIEND_REQUEST]: {
    method: 'post',
    path: '/v1/friends/request',
  },
  [WRITE_COMMANDS.ACCEPT_FRIEND_REQUEST]: {
    method: 'post',
    path: '/v1/friends/accept',
  },
  [WRITE_COMMANDS.DELETE_FRIEND_REQUEST]: {
    method: 'post',
    path: '/v1/friends/delete-request',
  },
  [WRITE_COMMANDS.UNFRIEND]: {
    method: 'post',
    path: '/v1/friends/remove',
  },
  [WRITE_COMMANDS.UPDATE_SESSION]: {
    method: 'post',
    path: '/v1/sessions/update',
  },
  [WRITE_COMMANDS.DELETE_SESSION]: {
    method: 'post',
    path: '/v1/sessions/delete',
  },
  [WRITE_COMMANDS.UPDATE_PREFERENCES]: {
    method: 'post',
    path: '/v1/preferences',
  },
  // Timezone lives under `users/$uid` but is written through the same
  // preferences endpoint (it handles a `timezone` object in the body).
  [WRITE_COMMANDS.UPDATE_AUTOMATIC_TIMEZONE]: {
    method: 'post',
    path: '/v1/preferences',
  },
  [WRITE_COMMANDS.UPDATE_SELECTED_TIMEZONE]: {
    method: 'post',
    path: '/v1/preferences',
  },
  [WRITE_COMMANDS.CAPTURE_SESSION_LOCATION]: {
    method: 'post',
    path: '/v1/session-locations/capture',
  },
  [WRITE_COMMANDS.CLEAR_SESSION_LOCATIONS]: {
    method: 'post',
    path: '/v1/session-locations/clear',
  },
  [WRITE_COMMANDS.PURGE_SESSION_LOCATIONS]: {
    method: 'post',
    path: '/v1/session-locations/purge',
  },
  [WRITE_COMMANDS.SET_HIDE_FROM_ALL_FRIENDS]: {
    method: 'post',
    path: '/v1/privacy/hide-from-all',
  },
  [WRITE_COMMANDS.SET_FRIEND_DATA_HIDDEN]: {
    method: 'post',
    path: '/v1/privacy/friend',
  },
  [SIDE_EFFECT_REQUEST_COMMANDS.GET_FEEDBACK_LIST]: {
    method: 'get',
    path: '/v1/feedback',
  },
  [SIDE_EFFECT_REQUEST_COMMANDS.GET_BUG_LIST]: {
    method: 'get',
    path: '/v1/feedback/bug',
  },
  [WRITE_COMMANDS.SUBMIT_FEEDBACK]: {
    method: 'post',
    path: '/v1/feedback',
  },
  [WRITE_COMMANDS.REPORT_BUG]: {
    method: 'post',
    path: '/v1/feedback/bug',
  },
  [WRITE_COMMANDS.REMOVE_FEEDBACK]: {
    method: 'post',
    path: '/v1/feedback/:feedbackId/remove',
    toPath: data =>
      `/v1/feedback/${encodeURIComponent(String(data.feedbackId))}/remove`,
  },
  [WRITE_COMMANDS.REMOVE_BUG]: {
    method: 'post',
    path: '/v1/feedback/bug/:bugId/remove',
    toPath: data =>
      `/v1/feedback/bug/${encodeURIComponent(String(data.bugId))}/remove`,
  },
  [WRITE_COMMANDS.UPDATE_DISPLAY_NAME]: {
    method: 'post',
    path: '/v1/profile/display-name',
  },
  [WRITE_COMMANDS.SET_USERNAME]: {
    method: 'post',
    path: '/v1/profile/username',
  },
  [WRITE_COMMANDS.UPDATE_LEGAL_NAME]: {
    method: 'post',
    path: '/v1/profile/name',
  },
  [WRITE_COMMANDS.UPDATE_PROFILE_PHOTO]: {
    method: 'post',
    path: '/v1/profile/photo',
  },
  [WRITE_COMMANDS.SYNC_USER_STATUS]: {
    method: 'post',
    path: '/v1/status/sync',
  },
  [WRITE_COMMANDS.ACCEPT_TERMS]: {
    method: 'post',
    path: '/v1/onboarding/accept-terms',
  },
  [WRITE_COMMANDS.COMPLETE_ONBOARDING]: {
    method: 'post',
    path: '/v1/onboarding/complete',
  },
  [WRITE_COMMANDS.SET_ONBOARDING_LAST_VISITED_PATH]: {
    method: 'post',
    path: '/v1/onboarding/last-visited-path',
  },
};

/**
 * kiroku-api paths that are reached by a plain `fetch` instead of the
 * `API.write/read` pipeline. Each of these genuinely cannot use the pipeline
 * (see the per-entry note), but their path strings still belong here so this
 * file remains the single source of truth for every `/v1/...` path the client
 * knows about. Always combine with `ApiUtils.getKirokuApiRoot()` for the root.
 */
const KIROKU_DIRECT_PATHS = {
  /**
   * Public, unauthenticated signup gate. Runs BEFORE a Firebase Auth account
   * (and therefore any ID token) exists, so it cannot go through the
   * authenticated `API.read` pipeline. See `actions/User.signUp`.
   */
  MIN_VERSION: '/v1/app/min-version',
  /**
   * Pusher channel authorization. pusher-js's authorizer signature cannot
   * attach our `Authorization: Bearer <ID token>` header, which this endpoint
   * requires, so it is called directly. See `Pusher/kirokuAuthorizer`.
   */
  PUSHER_AUTH: '/v1/pusher/auth',
} as const;

/** Returns the kiroku-api route for a command, or undefined for legacy commands. */
function getKirokuRoute(command: string): KirokuRoute | undefined {
  return KIROKU_ROUTES[command];
}

export {getKirokuRoute, KIROKU_DIRECT_PATHS};
export type {KirokuRoute};
