import {
  request,
  type APIRequestContext,
  type Page,
  type WebSocketRoute,
} from '@playwright/test';

/**
 * Helpers for the reconnect catch-up specs (`reconnect.spec.ts`): reading the
 * app's Onyx state, recording its `/v1/app/open` calls, flipping page
 * visibility, and writing to the backend as "another device" signed into the
 * same account.
 */

/** Onyx keys the specs read (values of the matching `ONYXKEYS` entries). */
export const ONYX_KEYS = {
  LAST_UPDATE_ID: 'OnyxUpdatesLastUpdateIDAppliedToClient',
  NETWORK: 'network',
  CACHED_SESSIONS: 'cachedDrinkingSessions',
  SESSION: 'session',
} as const;

/**
 * Read one Onyx key straight from the IndexedDB store Onyx persists to on web
 * (`OnyxDB` / `keyvaluepairs`). Onyx writes through to storage asynchronously,
 * so poll this rather than reading it once.
 */
export async function readOnyx<T>(page: Page, key: string): Promise<T | null> {
  return page.evaluate(
    onyxKey =>
      new Promise<T | null>((resolve, reject) => {
        const open = indexedDB.open('OnyxDB');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result
            .transaction('keyvaluepairs', 'readonly')
            .objectStore('keyvaluepairs')
            .get(onyxKey);
          get.onsuccess = () => resolve((get.result as T | undefined) ?? null);
          get.onerror = () => reject(get.error);
        };
      }),
    key,
  );
}

type OnyxUpdate = {key: string; onyxMethod?: string; value?: unknown};

/** One `GET /v1/app/open` the app made (OpenApp or ReconnectApp). */
export type AppOpenCall = {
  /** The `updateIDFrom` query param, or null for a full open. */
  updateIDFrom: number | null;
  status: number;
  /** `lastUpdateID` stamped on the response, if any. */
  lastUpdateID: number | undefined;
  onyxData: OnyxUpdate[];
  /** The distinct Onyx keys the response touched. */
  keys: string[];
  /** The kiroku-api root the build talks to (everything before `/v1/`). */
  apiRoot: string;
};

/**
 * Record every `GET /v1/app/open` response for the page's lifetime. Attach it
 * before navigating so the cold-start OpenApp is captured too. Returns the live
 * array, which fills as responses arrive (poll it).
 */
export function recordAppOpen(page: Page): AppOpenCall[] {
  const calls: AppOpenCall[] = [];
  page.on('response', async response => {
    const url = new URL(response.url());
    if (
      !url.pathname.endsWith('/v1/app/open') ||
      response.request().method() !== 'GET'
    ) {
      return;
    }
    let body: {lastUpdateID?: number; onyxData?: OnyxUpdate[]} = {};
    try {
      body = (await response.json()) as typeof body;
    } catch {
      // A failed or aborted response has no body; record it anyway.
    }
    const rawFrom = url.searchParams.get('updateIDFrom');
    const onyxData = body.onyxData ?? [];
    calls.push({
      updateIDFrom: rawFrom === null ? null : Number(rawFrom),
      status: response.status(),
      lastUpdateID: body.lastUpdateID,
      onyxData,
      keys: [...new Set(onyxData.map(update => update.key))],
      apiRoot: response.url().split('/v1/')[0],
    });
  });
  return calls;
}

/**
 * Record why the app caught up: the `<reason>` of every
 * `[Reconnect] Catching up (<reason>) ...` log line (see actions/Reconnect),
 * e.g. `connectivity resumed` or `realtime or auth reconnected`. Relies on the
 * dev-mode console logging the local and preview-channel builds both have.
 */
export function recordCatchUpReasons(page: Page): string[] {
  const reasons: string[] = [];
  page.on('console', message => {
    const match = /\[Reconnect\] Catching up \(([^)]+)\)/.exec(message.text());
    if (match) {
      reasons.push(match[1]);
    }
  });
  return reasons;
}

/**
 * Simulate the tab going to the background and back. Headless Chromium never
 * hides a page on its own, so this overrides `document.visibilityState` /
 * `document.hidden` and fires `visibilitychange`, which is exactly what
 * react-native-web's `AppState` listens to.
 */
export async function setPageVisibility(
  page: Page,
  state: 'hidden' | 'visible',
): Promise<void> {
  await page.evaluate(visibility => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => visibility === 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

/**
 * A switch on the page's realtime (Pusher) connection. `context.setOffline`
 * does not cut an already-open WebSocket, so without this the app keeps
 * receiving live updates "offline" and never misses anything. Every Pusher
 * socket is proxied to the real server while the link is up; `drop()` closes
 * the open ones and refuses new ones until `restore()`. The HTTP fallback
 * transports are blocked so pusher-js can't route around the switch.
 */
export class PusherLink {
  private isUp = true;

  private readonly open = new Set<{
    page: WebSocketRoute;
    server: WebSocketRoute;
  }>();

  /** Attach before navigating, so the first Pusher socket is proxied too. */
  static async attach(page: Page): Promise<PusherLink> {
    const link = new PusherLink();
    await page.routeWebSocket(/\.pusher\.com\//, socket => link.accept(socket));
    await page.route(/sockjs.*\.pusher\.com\//, route => route.abort());
    return link;
  }

  private accept(socket: WebSocketRoute) {
    if (!this.isUp) {
      // 4100-4199: pusher-js backs off and retries.
      void socket.close({code: 4100, reason: 'e2e: realtime link down'});
      return;
    }
    const pair = {page: socket, server: socket.connectToServer()};
    this.open.add(pair);
    socket.onClose(() => this.open.delete(pair));
  }

  /** Cut the realtime connection and keep it down. */
  async drop(): Promise<void> {
    this.isUp = false;
    const pairs = [...this.open];
    this.open.clear();
    await Promise.all(
      pairs.map(async ({page, server}) => {
        await server.close().catch(() => {});
        await page
          .close({code: 4100, reason: 'e2e: realtime link down'})
          .catch(() => {});
      }),
    );
  }

  /** Let pusher-js reconnect (on its next retry). */
  restore(): void {
    this.isUp = true;
  }
}

/** The signed-in user's current Firebase ID token, from the page's own storage. */
async function readIdToken(page: Page): Promise<string> {
  const token = await page.evaluate(
    () =>
      new Promise<string | null>((resolve, reject) => {
        const open = indexedDB.open('firebaseLocalStorageDb');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result
            .transaction('firebaseLocalStorage', 'readonly')
            .objectStore('firebaseLocalStorage')
            .getAll();
          all.onsuccess = () => {
            const entries = all.result as Array<{
              fbase_key?: string;
              value?: {stsTokenManager?: {accessToken?: string}};
            }>;
            const user = entries.find(entry =>
              entry.fbase_key?.startsWith('firebase:authUser:'),
            );
            resolve(user?.value?.stsTokenManager?.accessToken ?? null);
          };
          all.onerror = () => reject(all.error);
        };
      }),
  );
  if (!token) {
    throw new Error('No Firebase ID token in the page; is it signed in?');
  }
  return token;
}

/** A minimal past (non-live) drinking session the API accepts. */
export function makePastSession(startTime: number) {
  return {
    start_time: startTime,
    end_time: startTime + 60 * 60 * 1000,
    drinks: {[startTime]: {beer: 1}},
    ongoing: false,
  };
}

/**
 * "Another device" signed into the same account: calls kiroku-api directly
 * from the test runner, so its writes land in the account's update log without
 * this page seeing them. It runs outside the browser context, so it keeps
 * working while the page is offline.
 */
export class OtherDevice {
  private constructor(private readonly api: APIRequestContext) {}

  static async signInAs(page: Page, apiRoot: string): Promise<OtherDevice> {
    const token = await readIdToken(page);
    const api = await request.newContext({
      baseURL: `${apiRoot}/`,
      extraHTTPHeaders: {Authorization: `Bearer ${token}`},
    });
    return new OtherDevice(api);
  }

  async saveSession(
    sessionId: string,
    session: ReturnType<typeof makePastSession>,
  ): Promise<void> {
    const response = await this.api.post('v1/sessions/update', {
      data: {sessionId, session},
    });
    if (!response.ok()) {
      throw new Error(
        `sessions/update failed: ${response.status()} ${await response.text()}`,
      );
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const response = await this.api.post('v1/sessions/delete', {
      data: {sessionId},
    });
    if (!response.ok()) {
      throw new Error(
        `sessions/delete failed: ${response.status()} ${await response.text()}`,
      );
    }
  }

  async dispose(): Promise<void> {
    await this.api.dispose();
  }
}
