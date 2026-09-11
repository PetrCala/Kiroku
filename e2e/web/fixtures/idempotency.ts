import type {APIResponse, Page, Request, Response} from '@playwright/test';

/**
 * Helpers for the idempotency-key specs: observe the `Idempotency-Key` header on
 * the app's kiroku-api traffic, see how the server answered each attempt, and
 * read the session back from the server.
 *
 * Header names are lowercase because Playwright normalizes them that way.
 */
const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
const REPLAYED_HEADER = 'idempotent-replayed';
const SESSION_UPDATE_PATH = '/v1/sessions/update';

/** The key shape kiroku-api accepts (`IDEMPOTENCY_KEY_PATTERN` there). */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

/** One request the app sent to kiroku-api. */
export type ApiCall = {
  method: string;
  path: string;
  key: string | undefined;
  body: string | null;
};

/** How kiroku-api answered one attempt of a write. */
export type ServerAnswer = {
  /** When the attempt was sent (epoch ms), to explain timing-dependent runs. */
  sentAt: number;
  key: string | undefined;
  status: number;
  replayed: boolean;
  retryAfter: string | undefined;
  body: string;
};

/** Where the app's kiroku-api lives and the credentials it sends there. */
export type ApiAccess = {
  root: string;
  authorization: string;
  uid: string;
};

type SessionBody = {
  sessionId?: string;
  session?: {ongoing?: boolean; start_time?: number; drinks?: unknown};
};

function apiPath(url: string): string {
  const {pathname} = new URL(url);
  return pathname.slice(pathname.indexOf('/v1/'));
}

// Firebase Auth's REST API (`identitytoolkit.googleapis.com/v1/...`) also uses
// a `/v1/` prefix, so rule it out by host.
function isKirokuApi(request: Request): boolean {
  const url = new URL(request.url());
  return (
    url.pathname.includes('/v1/') && !url.hostname.endsWith('googleapis.com')
  );
}

/** Record every kiroku-api request the page sends from now on. */
export function recordApiCalls(page: Page): ApiCall[] {
  const calls: ApiCall[] = [];
  page.on('request', request => {
    if (!isKirokuApi(request) || request.method() === 'OPTIONS') {
      return;
    }
    calls.push({
      method: request.method(),
      path: apiPath(request.url()),
      key: request.headers()[IDEMPOTENCY_KEY_HEADER],
      body: request.postData(),
    });
  });
  return calls;
}

/**
 * The request finalizing (saving) `sessionId`: a `sessions/update` whose
 * session is no longer ongoing. The live-session persists before it carry
 * `ongoing: true`, so they are left alone.
 */
export function isFinalizeOf(request: Request, sessionId: string): boolean {
  if (
    request.method() !== 'POST' ||
    !request.url().includes(SESSION_UPDATE_PATH)
  ) {
    return false;
  }
  const body = request.postDataJSON() as SessionBody | null;
  return body?.sessionId === sessionId && body.session?.ongoing !== true;
}

/** Parse the session payload a finalize request carries. */
export function finalizeBody(request: Request): Required<SessionBody> {
  return request.postDataJSON() as Required<SessionBody>;
}

export async function toServerAnswer(
  request: Request,
  response: Response | APIResponse,
  sentAt: number,
): Promise<ServerAnswer> {
  const headers = response.headers();
  return {
    sentAt,
    key: request.headers()[IDEMPOTENCY_KEY_HEADER],
    status: response.status(),
    replayed: headers[REPLAYED_HEADER] === 'true',
    retryAfter: headers['retry-after'],
    body: await response.text(),
  };
}

/**
 * Record the server's answer to every finalize of `sessionId` that reaches the
 * app. An attempt whose response a spec aborts never shows up here; specs keep
 * that answer themselves from `route.fetch()`.
 */
export function recordFinalizeAnswers(
  page: Page,
  sessionId: string,
): ServerAnswer[] {
  const answers: ServerAnswer[] = [];
  page.on('response', response => {
    if (!isFinalizeOf(response.request(), sessionId)) {
      return;
    }
    const request = response.request();
    toServerAnswer(request, response, request.timing().startTime)
      .then(answer => answers.push(answer))
      .catch(() => {});
  });
  return answers;
}

/** The Firebase uid from the `sub` claim of a `Bearer` ID token. */
function uidFromAuthorization(authorization: string): string {
  const payload = authorization.replace(/^Bearer /, '').split('.')[1] ?? '';
  const claims = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as {sub?: string};
  if (!claims.sub) {
    throw new Error('The ID token has no sub claim');
  }
  return claims.sub;
}

/**
 * Resolve on the first authenticated kiroku-api request the page sends and
 * return its API root and credentials, so a spec can talk to the same server
 * as the app. Call it before the navigation that triggers the request.
 */
export async function captureApiAccess(page: Page): Promise<ApiAccess> {
  const request = await page.waitForRequest(
    candidate => isKirokuApi(candidate) && !!candidate.headers().authorization,
  );
  const {authorization} = request.headers();
  const url = request.url();
  return {
    root: url.slice(0, url.indexOf('/v1/')),
    authorization,
    uid: uidFromAuthorization(authorization),
  };
}

/**
 * Whether the server behind `api` handles idempotency keys (kiroku-api #145).
 * A malformed key is rejected by the middleware before the handler runs; an
 * older server skips the header and fails the empty payload instead. Neither
 * answer writes anything.
 */
export async function serverHandlesIdempotencyKeys(
  page: Page,
  api: ApiAccess,
): Promise<boolean> {
  const response = await page.request.post(`${api.root}/v1/sessions/delete`, {
    headers: {
      authorization: api.authorization,
      [IDEMPOTENCY_KEY_HEADER]: 'not a key',
    },
    data: {},
  });
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
  };
  return (
    response.status() === 400 && body.message === 'Invalid idempotency key'
  );
}

/**
 * The user's sessions the server holds that started at `startTime`, read
 * straight from kiroku-api rather than from the app's local cache.
 */
export async function readSessionsStartingAt(
  page: Page,
  api: ApiAccess,
  startTime: number,
): Promise<Record<string, {start_time?: number; drinks?: unknown}>> {
  const response = await page.request.get(
    `${api.root}/v1/users/${api.uid}/sessions?from=${startTime}`,
    {headers: {authorization: api.authorization}},
  );
  if (!response.ok()) {
    throw new Error(`Reading sessions failed: ${response.status()}`);
  }
  const {onyxData} = (await response.json()) as {
    onyxData: Array<{value?: Record<string, Record<string, never>>}>;
  };
  const sessions = onyxData.at(0)?.value?.[api.uid] ?? {};
  return Object.fromEntries(
    Object.entries(sessions).filter(
      ([, session]) =>
        (session as {start_time?: number}).start_time === startTime,
    ),
  );
}

/**
 * Send a session write straight to kiroku-api, with `key` as its
 * `Idempotency-Key` when given, and report how the server answered.
 */
export async function postSessionWrite(
  page: Page,
  api: ApiAccess,
  endpoint: 'update' | 'delete',
  data: Record<string, unknown>,
  key?: string,
): Promise<ServerAnswer> {
  const sentAt = Date.now();
  const response = await page.request.post(
    `${api.root}/v1/sessions/${endpoint}`,
    {
      headers: {
        authorization: api.authorization,
        ...(key === undefined ? {} : {[IDEMPOTENCY_KEY_HEADER]: key}),
      },
      data,
    },
  );
  const headers = response.headers();
  return {
    sentAt,
    key,
    status: response.status(),
    replayed: headers[REPLAYED_HEADER] === 'true',
    retryAfter: headers['retry-after'],
    body: await response.text(),
  };
}

/**
 * Safety net for the shared dev account: delete the session straight through
 * the API if a spec failed before its own UI cleanup ran. Deleting a session
 * that is already gone is a no-op on the server.
 */
export async function deleteSessionViaApi(
  page: Page,
  api: ApiAccess,
  sessionId: string,
): Promise<void> {
  await page.request.post(`${api.root}/v1/sessions/delete`, {
    headers: {authorization: api.authorization},
    data: {sessionId, sessionIsLive: true},
  });
}
