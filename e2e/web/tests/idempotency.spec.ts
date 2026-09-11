import {randomUUID} from 'node:crypto';
import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures/auth';
import {
  IDEMPOTENCY_KEY_PATTERN,
  captureApiAccess,
  deleteSessionViaApi,
  finalizeBody,
  isFinalizeOf,
  postSessionWrite,
  readSessionsStartingAt,
  recordApiCalls,
  recordFinalizeAnswers,
  serverHandlesIdempotencyKeys,
  toServerAnswer,
} from '../fixtures/idempotency';
import type {ApiAccess, ServerAnswer} from '../fixtures/idempotency';
import {DayOverviewPage, localDateString} from '../pages/DayOverviewPage';
import {HomePage} from '../pages/HomePage';
import {SessionPage} from '../pages/SessionPage';

/**
 * Idempotency keys (Kiroku #1663, kiroku-api #145): `API.write` mints one key
 * per queued write and persists it with the request, `HttpUtils` sends it as
 * the `Idempotency-Key` header, and kiroku-api answers a repeat of a key it
 * already applied from its record (`Idempotent-Replayed: true`) instead of
 * running the handler again.
 *
 * The specs lose the server's answer to a session save on its way back to the
 * app (`page.route` delivers the request with `route.fetch()`, then aborts the
 * response), which is exactly when the app's queue replays a write, and check
 * that the replay carries the same key, gets the original answer back, and
 * that the server holds the session once with the logged drinks.
 *
 * They need a kiroku-api that handles idempotency keys; against an older one
 * they skip (see `serverHandlesIdempotencyKeys`). Each spec deletes the session
 * it creates through the UI, with an API delete as a safety net if it fails
 * first, so the shared dev account does not accumulate sessions.
 */

/** Open Home, then return the app's API access, or skip on an older server. */
async function openHome(page: Page): Promise<ApiAccess> {
  const apiAccess = captureApiAccess(page);
  await new HomePage(page).goto();
  const api = await apiAccess;
  test.skip(
    !(await serverHandlesIdempotencyKeys(page, api)),
    `kiroku-api at ${api.root} does not handle idempotency keys yet (kiroku-api #145)`,
  );
  return api;
}

/** Start a live session and log one drink; resolve with the session id. */
async function startSessionWithOneDrink(session: SessionPage): Promise<string> {
  await session.startLiveSession();
  const sessionId = session.currentSessionId();
  const unitsBefore = Number(await session.totalUnits().innerText());
  await session.logOneDrink();
  await expect
    .poll(async () => Number(await session.totalUnits().innerText()))
    .toBeGreaterThan(unitsBefore);
  return sessionId;
}

/**
 * What the spec saw of the one save it intercepts: the payload the app sent
 * and the answer the server gave to the attempt the app never got to see.
 */
type LostSave = {
  payload: ReturnType<typeof finalizeBody>;
  answer: Promise<ServerAnswer>;
};

/**
 * Deliver the first save of `sessionId` to the server but drop the answer on
 * its way back, as a connection lost mid-request would. While `holdRetries()`
 * is true, the app's retries are dropped too, before they reach the server.
 * Everything else passes through untouched.
 */
async function loseFirstSaveAnswer(
  page: Page,
  sessionId: string,
  options: {awaitServer: boolean; holdRetries?: () => boolean},
): Promise<{lost: LostSave[]; heldRetryKeys: Array<string | undefined>}> {
  const lost: LostSave[] = [];
  const heldRetryKeys: Array<string | undefined> = [];
  await page.route('**/v1/sessions/update', async route => {
    const request = route.request();
    if (!isFinalizeOf(request, sessionId)) {
      await route.fallback();
      return;
    }
    if (lost.length === 0) {
      const sentAt = Date.now();
      const answer = route
        .fetch()
        .then(response => toServerAnswer(request, response, sentAt));
      lost.push({payload: finalizeBody(request), answer});
      if (options.awaitServer) {
        await answer;
      }
      await route.abort('failed');
      return;
    }
    if (options.holdRetries?.()) {
      heldRetryKeys.push(request.headers()['idempotency-key']);
      await route.abort('failed');
      return;
    }
    await route.fallback();
  });
  return {lost, heldRetryKeys};
}

/**
 * The server holds exactly one session that started when this one did, under
 * this id, with the drinks the save sent. A second application of the write
 * under another id, or a lost write, would both fail this.
 */
async function expectSavedOnce(
  page: Page,
  api: ApiAccess,
  sessionId: string,
  payload: LostSave['payload'],
): Promise<void> {
  const sessions = await readSessionsStartingAt(
    page,
    api,
    Number(payload.session.start_time),
  );
  expect(Object.keys(sessions)).toEqual([sessionId]);
  expect(sessions[sessionId].drinks).toEqual(payload.session.drinks);
}

test.describe('idempotency keys', () => {
  // Each spec boots the app (a cold load of the dev bundle takes a while),
  // runs a full session, and waits out the queue's retries; the restart spec
  // boots it twice.
  test.describe.configure({timeout: 300_000});

  test('session writes send an Idempotency-Key header and reads do not', async ({
    authedPage: page,
  }) => {
    const calls = recordApiCalls(page);
    const session = new SessionPage(page);
    const api = await openHome(page);
    let sessionId: string | undefined;

    try {
      sessionId = await startSessionWithOneDrink(session);
      await session.save();
      await session.openEditFromSummary();
      await session.discardAndConfirm();

      const writes = calls.filter(
        call => call.method === 'POST' && call.path.startsWith('/v1/sessions/'),
      );
      for (const write of writes) {
        expect(write.key).toMatch(IDEMPOTENCY_KEY_PATTERN);
        // The key travels as a header only.
        expect(write.body).not.toContain('idempotencyKey');
      }
      // One key per write: the save and the delete are separate writes. (A
      // create write is not guaranteed: the FAB resumes a session that is
      // already ongoing on the shared account.)
      const save = writes.find(call => call.path === '/v1/sessions/update');
      const deletion = writes.find(call => call.path === '/v1/sessions/delete');
      expect(save?.key).toBeDefined();
      expect(deletion?.key).toBeDefined();
      expect(save?.key).not.toBe(deletion?.key);

      const reads = calls.filter(call => call.method === 'GET');
      expect(reads.length).toBeGreaterThan(0);
      expect(reads.filter(call => call.key !== undefined)).toEqual([]);
    } finally {
      if (sessionId) {
        await deleteSessionViaApi(page, api, sessionId);
      }
    }
  });

  test('a save whose answer is lost is retried with the same key and applied once', async ({
    authedPage: page,
  }) => {
    const session = new SessionPage(page);
    const api = await openHome(page);
    let sessionId: string | undefined;

    try {
      sessionId = await startSessionWithOneDrink(session);
      const answers = recordFinalizeAnswers(page, sessionId);
      const {lost} = await loseFirstSaveAnswer(page, sessionId, {
        awaitServer: true,
      });

      await session.saveButton().click();
      await session.summaryScreen().waitFor({state: 'visible'});
      // The queue retries the save until an answer reaches the app.
      await expect.poll(() => answers.length).toBeGreaterThan(0);

      expect(lost).toHaveLength(1);
      const original = await lost[0].answer;
      // The server ran the handler for the first attempt...
      expect(original).toMatchObject({status: 200, replayed: false});
      // ...and answered the retry, sent with the same key, from its record:
      // the same body (down to its lastUpdateID) without running it again.
      expect(answers[0]).toMatchObject({
        key: original.key,
        status: 200,
        replayed: true,
        body: original.body,
      });
      await expectSavedOnce(page, api, sessionId, lost[0].payload);

      // Deleting through the UI also shows the queue moves on after a replay.
      await session.openEditFromSummary();
      await session.discardAndConfirm();
    } finally {
      if (sessionId) {
        await deleteSessionViaApi(page, api, sessionId);
      }
    }
  });

  test('a save whose answer is lost is replayed with the same key after a restart', async ({
    authedPage: page,
  }) => {
    const session = new SessionPage(page);
    const dayOverview = new DayOverviewPage(page);
    const api = await openHome(page);
    let sessionId: string | undefined;

    try {
      sessionId = await startSessionWithOneDrink(session);
      const answers = recordFinalizeAnswers(page, sessionId);
      let restarted = false;
      const {lost, heldRetryKeys} = await loseFirstSaveAnswer(page, sessionId, {
        awaitServer: true,
        holdRetries: () => !restarted,
      });

      await session.saveButton().click();
      await session.summaryScreen().waitFor({state: 'visible'});
      // Wait for a retry to prove the save sits in the persisted queue, then
      // restart the app before any retry reaches the server.
      await expect.poll(() => heldRetryKeys.length).toBeGreaterThan(0);
      expect(lost).toHaveLength(1);
      const original = await lost[0].answer;
      expect(original).toMatchObject({status: 200, replayed: false});
      expect(heldRetryKeys).toEqual(heldRetryKeys.map(() => original.key));

      restarted = true;
      await new HomePage(page).goto();

      // The save replays from the queue persisted before the restart.
      await expect.poll(() => answers.length).toBeGreaterThan(0);
      expect(answers[0]).toMatchObject({
        key: original.key,
        status: 200,
        replayed: true,
        body: original.body,
      });
      await expectSavedOnce(page, api, sessionId, lost[0].payload);

      // Reopen the session from today's calendar and delete it through the UI,
      // which also shows the queue moves on after the replay.
      await dayOverview.openDay(localDateString());
      await dayOverview.sessionTile(sessionId).click();
      await session.summaryScreen().waitFor({state: 'visible'});
      await session.openEditFromSummary();
      await session.discardAndConfirm();
    } finally {
      if (sessionId) {
        await deleteSessionViaApi(page, api, sessionId);
      }
    }
  });

  test('a retry racing its still-running original does not apply the save twice', async ({
    authedPage: page,
  }) => {
    const session = new SessionPage(page);
    const api = await openHome(page);
    let sessionId: string | undefined;

    try {
      sessionId = await startSessionWithOneDrink(session);
      const answers = recordFinalizeAnswers(page, sessionId);
      // Drop the answer without waiting for the server, so the app's first
      // retry (10 to 100 ms later) races the original, which is still running.
      const {lost} = await loseFirstSaveAnswer(page, sessionId, {
        awaitServer: false,
      });

      await session.saveButton().click();
      await session.summaryScreen().waitFor({state: 'visible'});
      await expect
        .poll(() => answers.some(answer => answer.status === 200))
        .toBe(true);

      expect(lost).toHaveLength(1);
      const all = [await lost[0].answer, ...answers];
      // Whether a retry lands while the original still runs (and gets a 429)
      // depends on how fast the server takes up a concurrent request, so the
      // timeline is recorded rather than asserted. The spec below provokes
      // the 429 directly.
      test.info().annotations.push({
        type: 'attempts',
        description: all
          .map(
            answer =>
              `+${answer.sentAt - all[0].sentAt}ms ${answer.status}${answer.replayed ? ' replayed' : ''}`,
          )
          .join(', '),
      });
      expect(all.map(answer => answer.key)).toEqual(all.map(() => all[0].key));
      // Whichever attempt claimed the key first ran the handler; it ran once.
      expect(
        all.filter(answer => answer.status === 200 && !answer.replayed),
      ).toHaveLength(1);
      // Any other attempt was either told to retry shortly or replayed.
      for (const answer of all) {
        expect([200, 429]).toContain(answer.status);
        if (answer.status === 429) {
          expect(answer.retryAfter).toBe('1');
        }
      }
      await expectSavedOnce(page, api, sessionId, lost[0].payload);

      await session.openEditFromSummary();
      await session.discardAndConfirm();
    } finally {
      if (sessionId) {
        await deleteSessionViaApi(page, api, sessionId);
      }
    }
  });

  // The app's queue sends one request at a time, so the UI can't reliably
  // land a repeat inside the original's run; this spec talks to kiroku-api
  // directly with the app's credentials.
  test('a repeat that arrives while the original runs gets 429, and a key reused on another route gets 422', async ({
    authedPage: page,
  }) => {
    const api = await openHome(page);
    const startTime = Date.now();
    const sessionId = `e2e-idempotency-${startTime}`;
    const payload = {
      sessionId,
      session: {
        start_time: startTime,
        end_time: startTime,
        ongoing: false,
        type: 'edit',
        blackout: false,
        note: '',
        drinks: {},
      },
      sessionIsLive: false,
    };
    const key = randomUUID();

    try {
      // Serverless backends (and the Functions emulator) take up concurrent
      // requests on separate instances. Warm a few first, so the repeats
      // below don't sit in a cold start until the original has finished.
      await Promise.all(
        Array.from({length: 4}, () =>
          page.request.get(`${api.root}/v1/healthz`),
        ),
      );
      const attempts = await Promise.all(
        [0, 100, 200].map(async delay => {
          await page.waitForTimeout(delay);
          return postSessionWrite(page, api, 'update', payload, key);
        }),
      );
      const timeline = attempts
        .map(
          answer =>
            `+${answer.sentAt - startTime}ms ${answer.status}${answer.replayed ? ' replayed' : ''}`,
        )
        .join(', ');

      const applied = attempts.filter(
        answer => answer.status === 200 && !answer.replayed,
      );
      expect(applied, timeline).toHaveLength(1);
      const inFlight = attempts.filter(answer => answer.status === 429);
      expect(inFlight.length, timeline).toBeGreaterThan(0);
      for (const answer of attempts) {
        expect([200, 429], timeline).toContain(answer.status);
        if (answer.status === 429) {
          expect(answer.retryAfter).toBe('1');
        }
      }

      // Once the original has finished, a repeat is answered from its record.
      const repeat = await postSessionWrite(page, api, 'update', payload, key);
      expect(repeat).toMatchObject({
        status: 200,
        replayed: true,
        body: applied[0].body,
      });

      // The same key on another route is a client bug: rejected, not run.
      const reused = await postSessionWrite(
        page,
        api,
        'delete',
        {sessionId},
        key,
      );
      expect(reused.status).toBe(422);
      expect(
        Object.keys(await readSessionsStartingAt(page, api, startTime)),
      ).toEqual([sessionId]);
    } finally {
      await deleteSessionViaApi(page, api, sessionId);
    }
  });
});
