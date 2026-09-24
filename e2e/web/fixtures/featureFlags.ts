import type {Page, Request} from '@playwright/test';

/** An Onyx update instruction as kiroku-api sends it (`src/lib/onyx.ts`). */
type OnyxUpdate = {onyxMethod: string; key: string; value: unknown};

type AppOpenResponse = {jsonCode?: number; onyxData?: OnyxUpdate[]};

type AppConfig = Record<string, unknown>;

/** What a spec gets back from `overrideRemoteFeatureFlags`. */
type RemoteFeatureFlags = {
  /** Replace the overrides served on every later app-open response. */
  set: (flags: Record<string, unknown>) => void;
  /** The config (overrides included) the app was last served, if any. */
  lastServedConfig: () => AppConfig | undefined;
  /** Resolve once the next app-open response has been handed to the app. */
  nextAppOpen: () => Promise<void>;
};

// Both `OpenApp` and `ReconnectApp` hit `GET /v1/app/open` (see
// src/libs/API/kirokuRoutes.ts). Matched on the pathname so the query string
// and the API host (dev, staging, a preview channel) don't matter.
function isAppOpen(request: Request): boolean {
  return (
    request.method() === 'GET' &&
    new URL(request.url()).pathname.endsWith('/v1/app/open')
  );
}

/**
 * Serve the real `GET /v1/app/open` response with `config.feature_flags`
 * replaced by `flags`, so a spec can exercise remote overrides (kill switches)
 * without writing the dev RTDB `config` node, which is global: a real override
 * would change the app for every dev user and every other test run.
 *
 * `flags` fully replaces whatever overrides the backend holds, so the baseline
 * is deterministic: pass `{}` to get the compile-time defaults from
 * `CONST.FEATURES`. Attach before the first navigation.
 */
type OverrideOptions = {
  /**
   * Rewrite the rest of the app-open `onyxData` in the same interception, for
   * a spec that also needs to shape what the app boots with (two `page.route`
   * handlers cannot compose: each fetches and fulfils on its own).
   */
  transformOnyxData?: (updates: OnyxUpdate[]) => OnyxUpdate[];
};

export async function overrideRemoteFeatureFlags(
  page: Page,
  flags: Record<string, unknown>,
  options: OverrideOptions = {},
): Promise<RemoteFeatureFlags> {
  let currentFlags = flags;
  let servedConfig: AppConfig | undefined;
  let waiters: Array<() => void> = [];

  await page.route(
    url => url.pathname.endsWith('/v1/app/open'),
    async route => {
      if (!isAppOpen(route.request())) {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      if (!response.ok()) {
        await route.fulfill({response});
        return;
      }
      const body = (await response.json()) as AppOpenResponse;
      const updates = options.transformOnyxData
        ? options.transformOnyxData(body.onyxData ?? [])
        : body.onyxData ?? [];
      const configUpdate = updates.find(update => update.key === 'config');
      const config: AppConfig = {
        ...((configUpdate?.value as AppConfig | null) ?? {}),
        feature_flags: currentFlags,
      };
      if (configUpdate) {
        configUpdate.value = config;
      } else {
        updates.push({onyxMethod: 'set', key: 'config', value: config});
      }
      servedConfig = config;
      await route.fulfill({response, json: {...body, onyxData: updates}});
      const resolved = waiters;
      waiters = [];
      resolved.forEach(resolve => resolve());
    },
  );

  return {
    set: nextFlags => {
      currentFlags = nextFlags;
    },
    lastServedConfig: () => servedConfig,
    nextAppOpen: () =>
      new Promise<void>(resolve => {
        waiters.push(resolve);
      }),
  };
}

type PusherChannel = {
  subscribed: boolean;
  callbacks: {get: (eventName: string) => unknown[] | undefined};
  emit: (eventName: string, data: unknown) => void;
};
type PusherWindow = {
  getPusherInstance?: () => {
    channel: (name: string) => PusherChannel | undefined;
  } | null;
};

/**
 * Deliver a `configUpdate` event on the public `config` channel to the app's
 * own Pusher client, as if kiroku-api had broadcast `config` after an admin
 * change. Uses the debug `window.getPusherInstance` hook
 * (src/libs/Pusher/pusher.ts) and `channel.emit`, which runs the app's bound
 * handler locally; nothing is sent to Pusher, so no shared state changes.
 *
 * The app binds its handler only once the real subscription succeeds, so this
 * waits for a bound `configUpdate` listener first; an earlier emit would be
 * dropped, just as no real broadcast can reach an unsubscribed client.
 */
export async function emitConfigUpdate(
  page: Page,
  config: AppConfig,
): Promise<void> {
  await page.waitForFunction(
    () => {
      const channel = (window as unknown as PusherWindow)
        .getPusherInstance?.()
        ?.channel('config');
      return (
        !!channel?.subscribed &&
        (channel.callbacks.get('configUpdate')?.length ?? 0) > 0
      );
    },
    undefined,
    {timeout: 30_000},
  );
  await page.evaluate(nextConfig => {
    (window as unknown as PusherWindow)
      .getPusherInstance?.()
      ?.channel('config')
      ?.emit('configUpdate', nextConfig);
  }, config);
}

/**
 * The `feature_flags` Onyx has persisted for `config` (IndexedDB `OnyxDB`), or
 * `undefined` when the key or the field is absent. Reads storage, not React, so
 * it shows whether an override reached the app even when nothing re-rendered.
 */
export async function readPersistedFeatureFlags(page: Page): Promise<unknown> {
  return page.evaluate(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open('OnyxDB');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const read = open.result
            .transaction('keyvaluepairs', 'readonly')
            .objectStore('keyvaluepairs')
            .get('config');
          read.onerror = () => reject(read.error);
          read.onsuccess = () => {
            const config = read.result as {feature_flags?: unknown} | undefined;
            resolve(config?.feature_flags);
          };
        };
      }),
  );
}
