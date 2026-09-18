import type {Page} from '@playwright/test';

/** An Onyx update instruction as kiroku-api sends it (`src/lib/onyx.ts`). */
type OnyxUpdate = {onyxMethod: string; key: string; value: unknown};

type EnvelopeResponse = {jsonCode?: number; onyxData?: OnyxUpdate[]};

/** A 2x2 transparent PNG, small enough to inline as the served photo bytes. */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAACp8Z5+AAAAFUlEQVR42mNkYPhfz0BEwEQAAAxAAf/0C6PkAAAAAElFTkSuQmCC';

/** The photo id the fake photo is served under. */
const FAKE_PHOTO_ID = 'e2e-photo-1';

/**
 * Give a session one photo, without uploading anything.
 *
 * A real upload would need the picker (which Playwright cannot drive through
 * the OS file dialog on every platform) and would leave an object behind in the
 * shared dev bucket. Instead this fakes the two halves the detail page reads:
 *
 *   1. The photo RECORD, injected into the `cachedDrinkingSessions` update on
 *      the app-open response, which is where the page reads `session.photos`.
 *   2. The signed READ url, by fulfilling `GET /v1/images/session-photos` with
 *      an inline PNG instead of a real GCS url.
 *
 * Attach before the navigation that opens the session. `sessionId` is resolved
 * lazily through a getter, so a spec can attach this before it knows which
 * session it will create.
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
    url => url.pathname.endsWith('/v1/app/open'),
    async route => {
      const response = await route.fetch();
      if (!response.ok()) {
        await route.fulfill({response});
        return;
      }
      const sessionId = getSessionId();
      const body = (await response.json()) as EnvelopeResponse;
      const updates = body.onyxData ?? [];
      const sessionsUpdate = updates.find(
        update => update.key === 'cachedDrinkingSessions',
      );
      if (!sessionId || !sessionsUpdate) {
        await route.fulfill({response, json: body});
        return;
      }
      const byUser = (sessionsUpdate.value ?? {}) as Record<
        string,
        Record<string, Record<string, unknown>>
      >;
      for (const sessions of Object.values(byUser)) {
        if (sessions?.[sessionId]) {
          sessions[sessionId].photos = {[FAKE_PHOTO_ID]: photo};
        }
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
