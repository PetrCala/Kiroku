import type {RequestType} from '@src/types/onyx/Request';
import {SIDE_EFFECT_REQUEST_COMMANDS, WRITE_COMMANDS} from './types';

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
  [SIDE_EFFECT_REQUEST_COMMANDS.GET_MISSING_ONYX_MESSAGES]: {
    method: 'get',
    path: '/v1/updates',
    toQuery: data => ({
      from: Number(data.updateIDFrom ?? 0),
      to: Number(data.updateIDTo ?? 0),
    }),
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
};

/** Returns the kiroku-api route for a command, or undefined for legacy commands. */
function getKirokuRoute(command: string): KirokuRoute | undefined {
  return KIROKU_ROUTES[command];
}

export {getKirokuRoute};
export type {KirokuRoute};
