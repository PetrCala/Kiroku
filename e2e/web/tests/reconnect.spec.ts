import type {Page} from '@playwright/test';
import {test as authTest, expect} from '../fixtures/auth';
import {
  ONYX_KEYS,
  OtherDevice,
  PusherLink,
  makePastSession,
  readOnyx,
  recordAppOpen,
  recordCatchUpReasons,
  setPageVisibility,
  type AppOpenCall,
} from '../fixtures/reconnect';
import {DayOverviewPage, localDateString} from '../pages/DayOverviewPage';
import {HomePage} from '../pages/HomePage';

/**
 * Reconnect catch-up (actions/Reconnect): when the app may have missed updates,
 * it sends `GET /v1/app/open?updateIDFrom=<last applied update>` and the server
 * replays only the missed updates from the account's update log (plus config).
 *
 * Each test boots the app, makes it miss a change, and checks the catch-up
 * request, the shape of its response, and that the change reaches the Home
 * calendar without a reload. The missed change is a past drinking session
 * written by "another device" (the test runner calling kiroku-api directly as
 * the same user), because session writes land in the update log.
 *
 * Two things make the miss real:
 *   - `context.setOffline` does not cut an open WebSocket, so the app would keep
 *     receiving the change over Pusher. `PusherLink` cuts it explicitly.
 *   - The shared dev account also gets writes from other runs, so assertions
 *     look for this test's own session rather than an exact payload.
 *
 * Needs a kiroku-api with incremental reconnect (kiroku-api#146). Against an
 * older API the catch-up still works but returns the full payload, and the
 * incremental assertions fail. Self-cleaning: every session a test writes is
 * deleted on teardown, pass or fail.
 */

type Harness = {
  page: Page;
  link: PusherLink;
  calls: AppOpenCall[];
  reasons: string[];
  /** Write a past session on `dateString` from the other device. */
  saveSessionElsewhere: (dateString: string) => Promise<string>;
};

const test = authTest.extend<{harness: Harness}>({
  harness: async ({authedPage: page}, use) => {
    const link = await PusherLink.attach(page);
    const calls = recordAppOpen(page);
    const reasons = recordCatchUpReasons(page);

    await new HomePage(page).goto();
    // Let the cold-start OpenApp land and apply before a test starts missing
    // things, so its applied update id is the real baseline.
    await expect
      .poll(() => calls.filter(call => call.updateIDFrom === null).length)
      .toBeGreaterThan(0);
    const openApp = calls.find(call => call.updateIDFrom === null);
    if (!openApp) {
      throw new Error('No OpenApp response recorded');
    }
    await expect
      .poll(() => appliedUpdateID(page))
      .toBeGreaterThanOrEqual(openApp.lastUpdateID ?? 0);

    const device = await OtherDevice.signInAs(page, openApp.apiRoot);
    const createdSessionIds: string[] = [];

    await use({
      page,
      link,
      calls,
      reasons,
      saveSessionElsewhere: async dateString => {
        const [year, month, day] = dateString.split('-').map(Number);
        const sessionId = `e2e-reconnect-${Date.now()}`;
        createdSessionIds.push(sessionId);
        await device.saveSession(
          sessionId,
          makePastSession(new Date(year, month - 1, day, 12).getTime()),
        );
        return sessionId;
      },
    });

    for (const sessionId of createdSessionIds) {
      await device.deleteSession(sessionId);
    }
    await device.dispose();
  },
});

async function appliedUpdateID(page: Page): Promise<number> {
  return Number((await readOnyx<number>(page, ONYX_KEYS.LAST_UPDATE_ID)) ?? 0);
}

async function isOffline(page: Page): Promise<boolean> {
  const network = await readOnyx<{isOffline?: boolean}>(
    page,
    ONYX_KEYS.NETWORK,
  );
  return !!network?.isOffline;
}

/** Every session id in the app's cached drinking sessions, across users. */
async function cachedSessionIds(page: Page): Promise<string[]> {
  const cache = await readOnyx<Record<string, Record<string, unknown> | null>>(
    page,
    ONYX_KEYS.CACHED_SESSIONS,
  );
  return Object.values(cache ?? {}).flatMap(perUser =>
    Object.keys(perUser ?? {}),
  );
}

/** The catch-up requests (ReconnectApp): app/open calls carrying `updateIDFrom`. */
function catchUps(calls: AppOpenCall[]): AppOpenCall[] {
  return calls.filter(call => call.updateIDFrom !== null);
}

async function waitForCatchUp(calls: AppOpenCall[]): Promise<AppOpenCall> {
  await expect
    .poll(() => catchUps(calls).length, {
      message: 'the app never sent a ReconnectApp catch-up',
      timeout: 45_000,
    })
    .toBeGreaterThan(0);
  return catchUps(calls)[0];
}

/** The `calendar-day-<date>-has-sessions` wrapper, present only on days with sessions. */
function dayWithSessions(page: Page, dateString: string) {
  return page.getByTestId(`calendar-day-${dateString}-has-sessions`);
}

/**
 * A day in the current month (not today, where other specs start sessions)
 * that has no sessions yet, so the missed session visibly changes its cell.
 */
async function pickEmptyDay(page: Page): Promise<string> {
  const dayOverview = new DayOverviewPage(page);
  const today = new Date();
  await expect(dayOverview.dayCell(localDateString(today))).toBeVisible();
  const lastDay = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();
  for (let day = 1; day <= lastDay; day += 1) {
    const dateString = localDateString(
      new Date(today.getFullYear(), today.getMonth(), day),
    );
    if (
      day !== today.getDate() &&
      (await dayWithSessions(page, dateString).count()) === 0 &&
      (await dayOverview.dayCell(dateString).isVisible())
    ) {
      return dateString;
    }
  }
  throw new Error('No empty day left in the current month for a test session');
}

function carriesSession(call: AppOpenCall, sessionId: string): boolean {
  return call.onyxData.some(
    update =>
      update.key === ONYX_KEYS.CACHED_SESSIONS &&
      Object.values((update.value ?? {}) as Record<string, unknown>).some(
        perUser =>
          !!perUser && typeof perUser === 'object' && sessionId in perUser,
      ),
  );
}

/**
 * The catch-up replayed only what was missed: it started from the app's last
 * applied update, moved the baseline forward, carried the missed session, ended
 * with the config refresh, and none of the keys only a full OpenApp re-seeds.
 */
function expectIncrementalCatchUp(
  call: AppOpenCall,
  fromUpdateID: number,
  sessionId: string,
) {
  expect(call.status).toBe(200);
  expect(call.updateIDFrom).toBe(fromUpdateID);
  expect(call.lastUpdateID).toBeGreaterThan(fromUpdateID);
  expect(call.keys).not.toContain(ONYX_KEYS.SESSION);
  expect(call.keys).not.toContain('dataVisibility');
  expect(call.onyxData.at(-1)?.key).toBe('config');
  expect(carriesSession(call, sessionId)).toBe(true);
}

test.describe('reconnect catch-up', () => {
  test.describe.configure({timeout: 150_000});

  test('cold start does a full OpenApp and no catch-up', async ({harness}) => {
    const {page, calls} = harness;

    // Give the boot-time triggers (the first online signal, the first Pusher
    // subscription) time to fire; a catch-up here would duplicate OpenApp.
    await page.waitForTimeout(5_000);

    const opens = calls.filter(call => call.updateIDFrom === null);
    expect(opens).toHaveLength(1);
    expect(opens[0].status).toBe(200);
    expect(opens[0].lastUpdateID).toBeGreaterThan(0);
    expect(opens[0].keys).toEqual(
      expect.arrayContaining([
        ONYX_KEYS.SESSION,
        ONYX_KEYS.CACHED_SESSIONS,
        'config',
      ]),
    );
    expect(catchUps(calls)).toEqual([]);
  });

  test('catches up on a change missed while offline', async ({harness}) => {
    const {page, link, calls, reasons} = harness;
    const dateString = await pickEmptyDay(page);

    await link.drop();
    await page.context().setOffline(true);
    await expect.poll(() => isOffline(page)).toBe(true);
    const fromUpdateID = await appliedUpdateID(page);

    const sessionId = await harness.saveSessionElsewhere(dateString);
    await page.context().setOffline(false);

    const catchUp = await waitForCatchUp(calls);
    expect(reasons).toContain('connectivity resumed');
    expectIncrementalCatchUp(catchUp, fromUpdateID, sessionId);
    expect(catchUps(calls)).toHaveLength(1);

    await expect(dayWithSessions(page, dateString)).toBeVisible();
    await expect
      .poll(() => appliedUpdateID(page))
      .toBeGreaterThanOrEqual(catchUp.lastUpdateID ?? Infinity);
  });

  test('catches up when the realtime connection comes back', async ({
    harness,
  }) => {
    const {page, link, calls, reasons} = harness;
    const dateString = await pickEmptyDay(page);

    await link.drop();
    const fromUpdateID = await appliedUpdateID(page);
    const sessionId = await harness.saveSessionElsewhere(dateString);
    link.restore();

    const catchUp = await waitForCatchUp(calls);
    expect(reasons).toContain('realtime or auth reconnected');
    expectIncrementalCatchUp(catchUp, fromUpdateID, sessionId);
    await expect(dayWithSessions(page, dateString)).toBeVisible();
  });

  test('a reconnect with nothing missed only refreshes config', async ({
    harness,
  }) => {
    const {page, calls} = harness;

    // Realtime stays up, so the app is current when it comes back online.
    await page.context().setOffline(true);
    await expect.poll(() => isOffline(page)).toBe(true);
    await page.context().setOffline(false);

    const catchUp = await waitForCatchUp(calls);
    expect(catchUp.status).toBe(200);
    // Only config, and no lastUpdateID: the baseline doesn't move and the
    // client applies the config instead of discarding the response as stale.
    expect(catchUp.keys).toEqual(['config']);
    expect(catchUp.lastUpdateID).toBeUndefined();
    expect(await appliedUpdateID(page)).toBe(catchUp.updateIDFrom);
  });

  test('a burst of catch-up triggers sends one request', async ({harness}) => {
    const {page, link, calls, reasons} = harness;
    const gapFills: string[] = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname.endsWith('/v1/updates')) {
        gapFills.push(request.url());
      }
    });
    const dateString = await pickEmptyDay(page);

    await link.drop();
    await page.context().setOffline(true);
    await expect.poll(() => isOffline(page)).toBe(true);
    const fromUpdateID = await appliedUpdateID(page);
    const sessionId = await harness.saveSessionElsewhere(dateString);

    // Realtime comes back before the app confirms connectivity: hold the API
    // reachability probe down so the app stays offline while Pusher
    // reconnects and queues a catch-up, then let connectivity resume, which
    // triggers a second one.
    const healthz = /\/v1\/healthz/;
    await page.route(healthz, route => route.abort());
    await page.context().setOffline(false);
    link.restore();
    await expect
      .poll(() => reasons, {timeout: 45_000})
      .toContain('realtime or auth reconnected');
    expect(catchUps(calls)).toEqual([]);

    await page.unroute(healthz);
    await expect
      .poll(() => reasons, {timeout: 45_000})
      .toContain('connectivity resumed');
    const catchUp = await waitForCatchUp(calls);
    // Nothing else is in flight; a duplicate would follow within moments.
    await page.waitForTimeout(3_000);

    expect(catchUps(calls)).toHaveLength(1);
    expect(catchUp.status).toBe(200);
    expect(catchUp.keys).not.toContain(ONYX_KEYS.SESSION);
    if (catchUp.updateIDFrom === fromUpdateID) {
      expectIncrementalCatchUp(catchUp, fromUpdateID, sessionId);
    } else {
      // Another writer on the shared account reached the app over the
      // restored realtime link first. Its live update exposed the gap, the app
      // fetched the missed updates itself (GET /v1/updates), and the queued
      // catch-up was replaced with the newer id.
      expect(catchUp.updateIDFrom).toBeGreaterThan(fromUpdateID);
      expect(gapFills.length).toBeGreaterThan(0);
    }
    await expect.poll(() => cachedSessionIds(page)).toContain(sessionId);
    await expect(dayWithSessions(page, dateString)).toBeVisible();
  });

  // On web the foreground trigger never fires: AppStateMonitor only reports
  // becoming active where `shouldReportActivity` is true, and it is false on
  // web by design. Web relies on the realtime-reconnect path instead (covered
  // above). Enable this if web should also catch up on visibility changes.
  test.fixme(
    'catches up when the page returns to the foreground',
    async ({harness}) => {
      const {page, link, calls, reasons} = harness;
      const dateString = await pickEmptyDay(page);

      await setPageVisibility(page, 'hidden');
      await link.drop();
      const fromUpdateID = await appliedUpdateID(page);
      const sessionId = await harness.saveSessionElsewhere(dateString);
      await setPageVisibility(page, 'visible');

      const catchUp = await waitForCatchUp(calls);
      expect(reasons).toContain('app returned to the foreground');
      expectIncrementalCatchUp(catchUp, fromUpdateID, sessionId);
      await expect(dayWithSessions(page, dateString)).toBeVisible();
    },
  );
});
