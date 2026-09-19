import type {Page} from '@playwright/test';

/** An Onyx update instruction as kiroku-api sends it (`src/lib/onyx.ts`). */
type OnyxUpdate = {onyxMethod: string; key: string; value: unknown};

type EnvelopeResponse = {jsonCode?: number; onyxData?: OnyxUpdate[]};

/** A 2x2 opaque PNG, small enough to inline as the served photo bytes. */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mN4YDDhPwgzwBgAXPQKfQikbAUAAAAASUVORK5CYII=';

/** The photo id the fake photo is served under. */
const FAKE_PHOTO_ID = 'e2e-photo-1';

/**
 * The endpoints that carry a session in their `cachedDrinkingSessions` update,
 * and so can deliver the fake photo record with it.
 *
 * `/v1/sessions/update` answers a save by echoing the session the server
 * stored, which is the only one of the two that fires for a session created
 * inside the spec. `/v1/app/open` carries the window of existing sessions, for
 * a spec that opens one it did not just create.
 */
const SESSION_BEARING_PATHS = ['/v1/sessions/update', '/v1/app/open'];

/**
 * Attach the photo record to `sessionId` wherever the response carries that
 * session. Returns whether anything was changed, so a pass-through stays a
 * pass-through.
 */
function attachPhotoRecord(
  updates: OnyxUpdate[],
  sessionId: string,
  photo: Record<string, unknown>,
): boolean {
  let didAttach = false;
  for (const update of updates) {
    if (update.key !== 'cachedDrinkingSessions') {
      continue;
    }
    const byUser = (update.value ?? {}) as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    for (const sessions of Object.values(byUser)) {
      if (sessions?.[sessionId]) {
        sessions[sessionId].photos = {[FAKE_PHOTO_ID]: photo};
        didAttach = true;
      }
    }
  }
  return didAttach;
}

/**
 * Give a session one photo, without uploading anything.
 *
 * A real upload would need the picker (which Playwright cannot drive through
 * the OS file dialog on every platform) and would leave an object behind in the
 * shared dev bucket. Instead this fakes the two halves the detail page reads:
 *
 *   1. The photo RECORD, injected into the `cachedDrinkingSessions` update on
 *      whichever response carries the session (see `SESSION_BEARING_PATHS`),
 *      which is where the page reads `session.photos`.
 *   2. The signed READ url, by fulfilling `GET /v1/images/session-photos` with
 *      an inline PNG instead of a real GCS url.
 *
 * Attach before the session is created. `sessionId` is resolved lazily through
 * a getter, so a spec can attach this before it knows which session it will
 * create: the id only has to be known by the time the session is saved.
 */
export async function serveOneSessionPhoto(
  page: Page,
  getSessionId: () => string | undefined,
): Promise<{photoId: string}> {
  const photo = {
    path: `session_images/e2e/${FAKE_PHOTO_ID}/photo.png`,
    w: 2,
    h: 2,
    added_at: Date.now(),
    added_by: 'e2e',
  };

  // 1. The record, onto whichever session the spec is looking at.
  await page.route(
    url => SESSION_BEARING_PATHS.some(path => url.pathname.endsWith(path)),
    async route => {
      const response = await route.fetch();
      if (!response.ok()) {
        await route.fulfill({response});
        return;
      }
      const sessionId = getSessionId();
      const body = (await response.json()) as EnvelopeResponse;
      const updates = body.onyxData ?? [];
      if (!sessionId || !attachPhotoRecord(updates, sessionId, photo)) {
        await route.fulfill({response, json: body});
        return;
      }
      await route.fulfill({response, json: {...body, onyxData: updates}});
    },
  );

  // 2. The signed read url for it.
  await page.route(
    url => url.pathname.endsWith('/v1/images/session-photos'),
    async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jsonCode: 200,
          onyxData: [],
          photos: {
            [FAKE_PHOTO_ID]: {
              ...photo,
              url: `data:image/png;base64,${TINY_PNG_BASE64}`,
              expires_at: Date.now() + 15 * 60 * 1000,
            },
          },
        }),
      });
    },
  );

  return {photoId: FAKE_PHOTO_ID};
}

/**
 * Answer `GET /v1/images/session-photos` with an empty map, the server's own
 * "nothing you may see" answer, so a spec can assert the no-photos state
 * without depending on whatever the dev account's session happens to hold.
 */
export async function serveNoSessionPhotos(page: Page): Promise<void> {
  await page.route(
    url => url.pathname.endsWith('/v1/images/session-photos'),
    async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({jsonCode: 200, onyxData: [], photos: {}}),
      });
    },
  );
}
