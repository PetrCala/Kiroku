import type {Page, Route} from '@playwright/test';
import {test, expect} from '../fixtures/auth';
import {HomePage} from '../pages/HomePage';
import {SessionPage} from '../pages/SessionPage';

/**
 * Failure semantics of the persisted request queue, driven end to end on the
 * web build against a real kiroku-api, with `page.route` standing in for the
 * failure modes the queue must tell apart:
 *
 *  - a deterministic 4xx is sent ONCE, rolled back, and the write queued behind
 *    it goes out at once instead of waiting through the retry backoff;
 *  - a transient failure (408, 425, 429, 5xx, no response at all) keeps the
 *    write queued and it delivers once the server recovers, even after the
 *    whole retry budget is burned;
 *  - a write burning its whole retry budget stays queued and the next
 *    reconnection delivers it.
 *
 * Every test starts a real live session on the shared dev account and deletes
 * it again (awaiting the delete response) in a `finally`, whatever screen it
 * ends on.
 */

const UPDATE_PATH = '**/v1/sessions/update';
const DELETE_PATH = '/v1/sessions/delete';

// How long the whole retry backoff takes with the production tuning (10
// retries, waits doubling from ~100 ms to the 10 s cap): about 35 s. A write
// behind a rejected one used to wait this long.
const FULL_BACKOFF_MS = 35_000;

type SessionUpdateBody = {
  sessionId?: string;
  sessionIsLive?: boolean;
  session?: {drinks?: Record<string, unknown>; ongoing?: boolean};
};

type SeenUpdate = {
  at: number;
  sessionId: string;
  sessionIsLive: boolean;
  /** A live flush carries `ongoing: true`; the finalize carries `false`. */
  ongoing: boolean;
  drinks: number;
  /** HTTP status handed to the page; -1 means the request was aborted. */
  status: number;
  injected: boolean;
};

type Injection = {status: number} | {abort: true} | undefined;

/**
 * Intercept `POST /v1/sessions/update`. `decide` picks, per request, whether
 * to hand the page an injected status, abort it, or let it through to the
 * real API. Every request is recorded, including the ones that never reached
 * the server.
 */
async function interceptSessionUpdates(
  page: Page,
  decide: (body: SessionUpdateBody, seen: SeenUpdate[]) => Injection,
  seen: SeenUpdate[] = [],
): Promise<SeenUpdate[]> {
  await page.route(UPDATE_PATH, async (route: Route) => {
    const body = (route.request().postDataJSON() ?? {}) as SessionUpdateBody;
    const record: SeenUpdate = {
      at: Date.now(),
      sessionId: body.sessionId ?? '',
      sessionIsLive: !!body.sessionIsLive,
      ongoing: !!body.session?.ongoing,
      drinks: Object.keys(body.session?.drinks ?? {}).length,
      status: 0,
      injected: false,
    };
    seen.push(record);
    const injection = decide(body, seen);
    if (injection && 'abort' in injection) {
      record.status = -1;
      record.injected = true;
      await route.abort('failed');
      return;
    }
    if (injection) {
      record.status = injection.status;
      record.injected = true;
      await route.fulfill({
        status: injection.status,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
        },
        body: JSON.stringify({error: `injected ${injection.status} (e2e)`}),
      });
      return;
    }
    const response = await route.fetch();
    record.status = response.status();
    await route.fulfill({response});
  });
  return seen;
}

/**
 * Delete the session the test created, from whichever screen it ended on, and
 * wait for the delete to reach the server (the queue lives in the context's
 * IndexedDB, which dies with the context). Any injection is removed first so
 * the delete cannot be held up by an earlier failure.
 */
async function deleteSessionBestEffort(
  page: Page,
  session: SessionPage,
): Promise<void> {
  await page.unrouteAll({behavior: 'ignoreErrors'});
  const deleted = page
    .waitForResponse(response => response.url().includes(DELETE_PATH), {
      timeout: FULL_BACKOFF_MS + 10_000,
    })
    .catch(() => undefined);
  if (
    await session
      .summaryScreen()
      .isVisible()
      .catch(() => false)
  ) {
    await session.openEditFromSummary().catch(() => undefined);
  }
  if (
    !(await session
      .discardButton()
      .isVisible()
      .catch(() => false))
  ) {
    return;
  }
  await session.discardButton().click({timeout: 10_000});
  await session.confirmYesButton().click({timeout: 10_000});
  await deleted;
}

/** Start a live session on Home and hand back its id. */
async function startSession(page: Page, session: SessionPage): Promise<string> {
  const homePage = new HomePage(page);
  await homePage.goto();
  await expect(homePage.screen()).toBeVisible();
  await session.startLiveSession();
  return session.currentSessionId();
}

// A live session's create and its debounced flushes carry `ongoing: true`;
// its finalize (Save) carries `ongoing: false` and, like them, `sessionIsLive`.
const isLiveFlushWithDrinks = (body: SessionUpdateBody, sessionId: string) =>
  body.sessionId === sessionId &&
  !!body.session?.ongoing &&
  Object.keys(body.session?.drinks ?? {}).length > 0;

const isFinalize = (body: SessionUpdateBody, sessionId: string) =>
  body.sessionId === sessionId && body.session?.ongoing === false;

test.describe('request queue failure handling', () => {
  test('sends a rejected write once, rolls it back, and lets the write behind it through at once', async ({
    authedPage: page,
  }) => {
    const session = new SessionPage(page);
    let sessionId = '';
    try {
      sessionId = await startSession(page, session);

      // Every live flush of this session is rejected outright; the create
      // before it and the finalize after it reach the real API.
      const seen = await interceptSessionUpdates(page, body =>
        isLiveFlushWithDrinks(body, sessionId) ? {status: 422} : undefined,
      );
      const liveFlushes = () =>
        seen.filter(update => update.ongoing && update.drinks > 0);

      const unitsBefore = Number(await session.totalUnits().innerText());
      await session.logOneDrink();
      await expect
        .poll(async () => Number(await session.totalUnits().innerText()))
        .toBeGreaterThan(unitsBefore);
      const loggedUnits = await session.totalUnits().innerText();

      // The debounced flush goes out, is rejected, and its failure data
      // re-arms the persist; that loop is capped at three drops. Each drop is
      // a single attempt: no retry of a known rejection.
      await expect.poll(() => liveFlushes().length, {timeout: 10_000}).toBe(3);
      await page.waitForTimeout(2_500);
      expect(liveFlushes()).toHaveLength(3);
      expect(liveFlushes().every(update => update.status === 422)).toBe(true);
      // Three drops fit in a couple of debounce windows, not a backoff.
      const first = liveFlushes().at(0)?.at ?? 0;
      const last = liveFlushes().at(-1)?.at ?? 0;
      expect(last - first).toBeLessThan(6_000);

      // The finalize queued behind the rejected flush must not wait through
      // the backoff: it reaches the server within seconds of the tap.
      const savedAt = Date.now();
      await session.save();
      const finalize = seen.find(update => !update.ongoing);
      expect(finalize?.status).toBe(200);
      expect((finalize?.at ?? Infinity) - savedAt).toBeLessThan(5_000);
      // The drink survived the dropped flushes: the finalize carried it.
      expect(finalize?.drinks).toBe(1);

      await session.openEditFromSummary();
      await expect(session.totalUnits()).toHaveText(loggedUnits);
    } finally {
      await deleteSessionBestEffort(page, session);
    }
  });

  for (const failure of [
    {label: '408', injection: {status: 408} as Injection},
    {label: '425', injection: {status: 425} as Injection},
    {label: '429', injection: {status: 429} as Injection},
    {label: '503', injection: {status: 503} as Injection},
    {label: 'no response', injection: {abort: true} as Injection},
  ]) {
    test(`keeps a write queued through a transient ${failure.label} and delivers it once the server recovers`, async ({
      authedPage: page,
    }) => {
      const session = new SessionPage(page);
      let sessionId = '';
      try {
        sessionId = await startSession(page, session);

        // The finalize fails twice, then the server is healthy again.
        const seen = await interceptSessionUpdates(page, (body, all) => {
          if (!isFinalize(body, sessionId)) {
            return undefined;
          }
          const attempts = all.filter(update => !update.ongoing).length;
          return attempts <= 2 ? failure.injection : undefined;
        });

        const unitsBefore = Number(await session.totalUnits().innerText());
        await session.logOneDrink();
        await expect
          .poll(async () => Number(await session.totalUnits().innerText()))
          .toBeGreaterThan(unitsBefore);
        const loggedUnits = await session.totalUnits().innerText();

        // `save()` resolves only on a 2xx from the update endpoint.
        await session.save();
        const finalizes = seen.filter(update => !update.ongoing);
        expect(finalizes.length).toBeGreaterThanOrEqual(3);
        expect(finalizes.slice(0, 2).every(update => update.injected)).toBe(
          true,
        );
        expect(finalizes.at(-1)?.status).toBe(200);
        expect(finalizes.at(-1)?.drinks).toBe(1);

        await session.openEditFromSummary();
        await expect(session.totalUnits()).toHaveText(loggedUnits);
      } finally {
        await deleteSessionBestEffort(page, session);
      }
    });
  }

  test('keeps a write whose whole retry budget burned on 408, and the next reconnection delivers it', async ({
    authedPage: page,
  }) => {
    // Burning the full budget takes the whole backoff, then a probe cycle.
    test.setTimeout(FULL_BACKOFF_MS * 2 + 120_000);
    const session = new SessionPage(page);
    try {
      const sessionId = await startSession(page, session);

      // Every finalize attempt times out at the edge until the server
      // "recovers" below.
      let serverRecovered = false;
      const seen = await interceptSessionUpdates(page, body =>
        isFinalize(body, sessionId) && !serverRecovered
          ? {status: 408}
          : undefined,
      );
      const finalizes = () => seen.filter(update => !update.ongoing);

      const unitsBefore = Number(await session.totalUnits().innerText());
      await session.logOneDrink();
      await expect
        .poll(async () => Number(await session.totalUnits().innerText()))
        .toBeGreaterThan(unitsBefore);
      const loggedUnits = await session.totalUnits().innerText();

      await session.saveButton().click();
      await expect(session.summaryScreen()).toBeVisible();

      // Initial attempt plus ten retries, then the queue stalls with the
      // write still persisted (never dropped) until the next flush trigger.
      await expect
        .poll(() => finalizes().length, {timeout: FULL_BACKOFF_MS + 15_000})
        .toBe(11);
      await page.waitForTimeout(12_000);
      expect(finalizes()).toHaveLength(11);

      // A reconnection is one such trigger, and it hands the write a fresh
      // budget. Take the reachability probe down so the app goes offline,
      // heal the server, then let the probe bring the app back online.
      await page.route('**/v1/healthz', route => route.abort('failed'));
      await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
      await page.waitForTimeout(30_000);
      serverRecovered = true;
      await page.unroute('**/v1/healthz');
      await expect
        .poll(() => finalizes().some(update => update.status === 200), {
          timeout: 60_000,
          message: `finalize attempts: ${JSON.stringify(finalizes())}`,
        })
        .toBe(true);
      expect(finalizes().find(update => update.status === 200)?.drinks).toBe(1);

      await session.openEditFromSummary();
      await expect(session.totalUnits()).toHaveText(loggedUnits);
    } finally {
      await deleteSessionBestEffort(page, session);
    }
  });
});
