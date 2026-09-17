import type {Page, Response} from '@playwright/test';
import {test, expect} from '../fixtures/auth';
import {
  OP_MARKER_KEY,
  SESSION_OP_COMMAND,
  deleteLeftoverSession,
  getOnyxValue,
  getQueuedRequests,
  getQueuedSessionOps,
  getServerTimeOffset,
  getTimeSkew,
  hasE2EHooks,
  isBootstrapResponse,
  isSessionOpRequest,
  markerData,
  opBody,
  recordSessionOpRequests,
  sendSessionOp,
  setForceOffline,
  setSessionOpsEnabled,
  setTimeSkew,
} from '../fixtures/e2eHooks';
import {HomePage} from '../pages/HomePage';
import {SessionPage} from '../pages/SessionPage';

/**
 * The Sessions v2 op groundwork (Kiroku #1663, kiroku-api #148) end to end:
 * the server-time offset, the `POST /v1/sessions/ops` round trip with its
 * idempotency key, and the client's op coalescing.
 *
 * Nothing in the UI sends ops yet and `SESSION_OPS` ships off, so the specs
 * reach `sendSessionOp` through the dev-only page hooks and switch the flag on
 * for the page load only. They need a dev build (`npm run web` or a preview
 * channel) and a kiroku-api that has the ops endpoint, and skip otherwise.
 *
 * Self-cleaning: the one test that creates a real session deletes it, ops sent
 * to the server are no-ops (`ping`) or rejected, and anything still queued
 * dies with the browser context.
 */

/** An id the server accepts for ops that never touch a real session. */
function syntheticSessionId(label: string): string {
  return `e2e-${label}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Open the app and switch session ops on. Returns the bootstrap response, the
 * one the app measured the server-time offset from.
 */
async function bootWithSessionOps(page: Page): Promise<Response> {
  const bootstrap = page.waitForResponse(isBootstrapResponse);
  await new HomePage(page).goto();
  const response = await bootstrap;
  test.skip(
    !(await hasE2EHooks(page)),
    'Needs a dev build (npm run web or a preview channel): the page hooks are __DEV__ only.',
  );
  test.skip(
    response.headers()['x-server-time'] === undefined,
    'Needs a kiroku-api with X-Server-Time and /v1/sessions/ops (kiroku-api #148).',
  );
  await setSessionOpsEnabled(page, true);
  return response;
}

/**
 * How far the measured offset may sit from the truth. The server stamps
 * `X-Server-Time` somewhere inside the app's round trip and the app assumes
 * the midpoint, so the error is at most half the round trip. The app's round
 * trip also covers the CORS preflight, which the bootstrap request's own
 * timing doesn't, so allow the whole request duration plus scheduling slack.
 */
async function skewTolerance(bootstrap: Response): Promise<number> {
  await bootstrap.finished();
  return bootstrap.request().timing().responseEnd + 250;
}

function waitForOpResponse(
  page: Page,
  predicate: (response: Response) => boolean = () => true,
): Promise<Response> {
  return page.waitForResponse(
    response => isSessionOpRequest(response.request()) && predicate(response),
  );
}

test.describe('session ops: server time', () => {
  test('measures a near-zero offset on a correct clock, from a header the web can read', async ({
    authedPage: page,
  }) => {
    await bootWithSessionOps(page);

    // The web can read X-Server-Time cross-origin (CORS exposes it) but not
    // the standard Date header, which is why the precise header exists.
    const readable = await page.evaluate(async () => {
      const root = window.kirokuE2E?.getApiRoot() ?? '';
      const response = await fetch(`${root}/v1/healthz`);
      return {
        serverTime: response.headers.get('X-Server-Time'),
        date: response.headers.get('Date'),
      };
    });
    expect(Number(readable.serverTime)).toBeGreaterThan(0);
    expect(readable.date).toBeNull();

    // Plant a sentinel and boot again: the offset must be measured afresh,
    // not read back from storage.
    const sentinel = 987_654_321;
    await setTimeSkew(page, sentinel);
    await expect.poll(() => getTimeSkew(page)).toBe(sentinel);
    const bootstrap = page.waitForResponse(isBootstrapResponse);
    await page.reload();
    const tolerance = await skewTolerance(await bootstrap);

    await expect.poll(() => getTimeSkew(page)).not.toBe(sentinel);
    const skew = (await getTimeSkew(page)) ?? NaN;
    expect(Math.abs(skew)).toBeLessThanOrEqual(tolerance);

    // getServerTime() applies exactly that offset.
    const offset = await getServerTimeOffset(page);
    expect(skew).toBeGreaterThanOrEqual(offset.low);
    expect(skew).toBeLessThanOrEqual(offset.high);
  });

  // Minutes off, like the phones the offset exists for. Kept small because the
  // cached sign-in's ID token is checked against the browser clock: a clock
  // far behind would present a freshly expired token and get signed out.
  for (const shiftMinutes of [3, -3]) {
    const direction = shiftMinutes > 0 ? 'ahead' : 'behind';
    test(`measures the offset of a browser clock ${Math.abs(shiftMinutes)} minutes ${direction}`, async ({
      authedPage: page,
    }) => {
      const shift = shiftMinutes * 60_000;
      await page.clock.install({time: Date.now() + shift});

      const tolerance = await skewTolerance(await bootWithSessionOps(page));

      // The offset corrects the shift: the device is `shift` off, so the
      // server is `-shift` away from it.
      await expect
        .poll(async () => Math.abs(((await getTimeSkew(page)) ?? NaN) + shift))
        .toBeLessThanOrEqual(tolerance);

      // getServerTime() lands back on the real clock (this process's).
      const before = Date.now();
      const offset = await getServerTimeOffset(page);
      const after = Date.now();
      expect(offset.serverTime).toBeGreaterThanOrEqual(before - tolerance);
      expect(offset.serverTime).toBeLessThanOrEqual(after + tolerance);

      const skew = (await getTimeSkew(page)) ?? NaN;
      expect(skew).toBeGreaterThanOrEqual(offset.low);
      expect(skew).toBeLessThanOrEqual(offset.high);
    });
  }
});

test.describe('session ops: the ops endpoint', () => {
  test('stays off unless SESSION_OPS is on', async ({authedPage: page}) => {
    await bootWithSessionOps(page);
    await setSessionOpsEnabled(page, undefined);
    const sent = recordSessionOpRequests(page);

    const opId = await sendSessionOp(page, {
      sessionId: syntheticSessionId('off'),
      type: 'ping',
    });

    expect(opId).toBeUndefined();
    expect(await getQueuedSessionOps(page)).toEqual([]);
    // Give a stray request the time it would need to show up.
    await page.waitForTimeout(1_000);
    expect(sent).toEqual([]);
  });

  test('sends a ping keyed by its op id, and answers a replay after a lost response from the record', async ({
    authedPage: page,
  }) => {
    await bootWithSessionOps(page);
    const sent = recordSessionOpRequests(page);

    // The first attempt reaches the server, which applies and records it, but
    // its answer never makes it back: the queue retries with the same key.
    let firstAnswer: {status: number; body: unknown} | undefined;
    await page.route('**/v1/sessions/ops', async route => {
      if (firstAnswer) {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      firstAnswer = {status: response.status(), body: await response.json()};
      await route.abort('connectionreset');
    });

    const replayed = waitForOpResponse(
      page,
      response => response.headers()['idempotent-replayed'] === 'true',
    );
    const sessionId = syntheticSessionId('ping');
    const opId = await sendSessionOp(
      page,
      {sessionId, type: 'ping'},
      markerData(),
    );
    const replay = await replayed;

    // The envelope: the op id doubles as the Idempotency-Key, and client_ts
    // is on the server's clock (the test machine's, for a correct clock).
    expect(opId).toEqual(expect.any(String));
    const [original] = sent;
    expect(original.headers()['idempotency-key']).toBe(opId);
    const body = opBody(original);
    expect(body).toMatchObject({opId, sessionId, type: 'ping', payload: {}});
    expect(body).not.toHaveProperty('idempotencyKey');
    expect(Math.abs(Number(body.client_ts) - Date.now())).toBeLessThan(10_000);

    expect(firstAnswer).toEqual({
      status: 200,
      body: expect.objectContaining({jsonCode: 200, onyxData: []}),
    });

    // The retry carries the same key and op, and is served from the record.
    expect(sent).toHaveLength(2);
    expect(replay.request().headers()['idempotency-key']).toBe(opId);
    expect(opBody(replay.request())).toEqual(body);
    expect(replay.status()).toBe(200);
    expect(replay.headers()['access-control-expose-headers']).toMatch(
      /Idempotent-Replayed/i,
    );

    // The app took the replay as the success it is.
    await expect
      .poll(() => getOnyxValue(page, OP_MARKER_KEY))
      .toEqual({state: 'succeeded'});
    expect(await getQueuedSessionOps(page)).toEqual([]);
  });

  test('keeps a queued op across a reload and sends it under the same id', async ({
    authedPage: page,
  }) => {
    await bootWithSessionOps(page);
    await setForceOffline(page, true);
    const opId = await sendSessionOp(page, {
      sessionId: syntheticSessionId('reload'),
      type: 'ping',
    });
    await expect.poll(() => getQueuedSessionOps(page)).toHaveLength(1);

    // An app restart while offline: the op waits in the persisted queue. The
    // flag override is gone after the reload, which only gates new ops.
    await page.reload();
    await expect
      .poll(async () =>
        (await getQueuedSessionOps(page)).map(request => request.data?.opId),
      )
      .toEqual([opId]);

    const answered = waitForOpResponse(page);
    await setForceOffline(page, false);
    const response = await answered;
    expect(response.request().headers()['idempotency-key']).toBe(opId);
    expect(opBody(response.request()).opId).toBe(opId);
    expect(response.status()).toBe(200);
    await expect.poll(() => getQueuedSessionOps(page)).toEqual([]);
  });

  test('drops a rejected op with its failure data, and a session save queued behind it still goes through', async ({
    authedPage: page,
  }) => {
    test.setTimeout(180_000);
    const session = new SessionPage(page);
    await bootWithSessionOps(page);

    await session.startLiveSession();
    const sessionId = session.currentSessionId();
    // From here on a real session exists on the shared dev account: delete it
    // even when an assertion fails, or it leaks.
    let isDeleted = false;
    try {
      await session.logOneDrink();
      await expect(session.saveButton()).toBeEnabled();
      await expect.poll(() => getQueuedRequests(page)).toEqual([]);

      // Offline: an op the server doesn't implement yet, then the save.
      // `claim_entry` is a shared-session op, so it stays "not implemented"
      // now that W2 applies the solo ops (`add_entry` among them).
      await setForceOffline(page, true);
      const opId = await sendSessionOp(
        page,
        {sessionId, type: 'claim_entry', payload: {entryId: 'e2e-entry'}},
        markerData(),
      );
      expect(await getOnyxValue(page, OP_MARKER_KEY)).toEqual({
        state: 'pending',
      });
      await session.saveButton().click();
      await session.summaryScreen().waitFor({state: 'visible'});
      await expect
        .poll(async () =>
          (await getQueuedRequests(page)).map(request => request.command),
        )
        .toEqual([SESSION_OP_COMMAND, 'UpdateSession']);

      const opAnswers: Response[] = [];
      page.on('response', response => {
        if (isSessionOpRequest(response.request())) {
          opAnswers.push(response);
        }
      });
      const saved = page.waitForResponse(
        response =>
          response.url().includes('/v1/sessions/update') && response.ok(),
        {timeout: 30_000},
      );
      const reconnectedAt = Date.now();
      await setForceOffline(page, false);
      await saved;
      const stalledFor = Date.now() - reconnectedAt;

      // The server rejected the op every time it saw it, and never under
      // another key.
      expect(opAnswers.length).toBeGreaterThan(0);
      for (const answer of opAnswers) {
        expect(answer.status()).toBe(422);
        expect(answer.request().headers()['idempotency-key']).toBe(opId);
      }
      test.info().annotations.push({
        type: 'rejected op',
        description: `${opAnswers.length} attempt(s); the save went out ${stalledFor} ms after reconnecting`,
      });

      // Dropped, with its failure data applied, not retried forever.
      expect(await getOnyxValue(page, OP_MARKER_KEY)).toEqual({
        state: 'failed',
      });
      expect(await getQueuedSessionOps(page)).toEqual([]);

      // Clean up through the UI, the way a user deletes a saved session.
      await session.openEditFromSummary();
      const deleted = page.waitForResponse(
        response =>
          response.url().includes('/v1/sessions/delete') && response.ok(),
      );
      await session.discardButton().click();
      await session.confirmYesButton().click();
      await deleted;
      isDeleted = true;
    } finally {
      if (!isDeleted) {
        await deleteLeftoverSession(page, sessionId);
      }
    }
  });

  test('sends a rejected op once and moves on', async ({authedPage: page}) => {
    // kiroku-api answers an op it can't apply with a 4xx precisely so the
    // queue drops it and rolls it back after one attempt (routes/sessions
    // `POST /ops`; SequentialQueue drops a deterministic 4xx at once).
    await bootWithSessionOps(page);
    const sent = recordSessionOpRequests(page);

    await sendSessionOp(
      page,
      {
        sessionId: syntheticSessionId('rejected'),
        // A shared-session op, still answered "not implemented" now that W2
        // applies the solo ops.
        type: 'claim_entry',
        payload: {entryId: 'e2e-entry'},
      },
      markerData(),
    );

    await expect
      .poll(() => getOnyxValue(page, OP_MARKER_KEY), {timeout: 5_000})
      .toEqual({state: 'failed'});
    expect(sent).toHaveLength(1);
  });
});

test.describe('session ops: coalescing', () => {
  test('folds two offline edits of one entry into a single op under the second id', async ({
    authedPage: page,
  }) => {
    test.setTimeout(180_000);
    await bootWithSessionOps(page);
    const sent = recordSessionOpRequests(page);
    const sessionId = syntheticSessionId('coalesce');

    await setForceOffline(page, true);
    const firstId = await sendSessionOp(page, {
      sessionId,
      type: 'edit_entry',
      payload: {entryId: 'entry-1', drinkType: 'beer', count: 1, note: 'first'},
    });
    const secondId = await sendSessionOp(page, {
      sessionId,
      type: 'edit_entry',
      payload: {entryId: 'entry-1', count: 2},
    });
    expect(secondId).not.toBe(firstId);

    // One queued op: the second op's id and key, both ops' fields, the
    // later values winning.
    const mergedPayload = {
      entryId: 'entry-1',
      drinkType: 'beer',
      count: 2,
      note: 'first',
    };
    const queued = await getQueuedSessionOps(page);
    expect(queued).toHaveLength(1);
    expect(queued[0].data).toMatchObject({
      opId: secondId,
      idempotencyKey: secondId,
      sessionId,
      type: 'edit_entry',
      payload: mergedPayload,
    });

    // The server rejects edit_entry for now, so wait for the queue to drop it.
    await setForceOffline(page, false);
    await expect
      .poll(() => getQueuedSessionOps(page), {timeout: 30_000})
      .toEqual([]);

    // On the wire: one op, the merged one, never the first id.
    expect(sent.length).toBeGreaterThan(0);
    for (const request of sent) {
      expect(request.headers()['idempotency-key']).toBe(secondId);
      expect(opBody(request)).toMatchObject({
        opId: secondId,
        sessionId,
        type: 'edit_entry',
        payload: mergedPayload,
      });
    }
    test.info().annotations.push({
      type: 'coalesced op',
      description: `1 op on the wire, sent ${sent.length} time(s)`,
    });
  });

  test('never folds into an op in flight or one that failed and was put back', async ({
    authedPage: page,
  }) => {
    await bootWithSessionOps(page);
    const sessionId = syntheticSessionId('rollback');
    const edit = (payload: Record<string, unknown>) =>
      sendSessionOp(page, {
        sessionId,
        type: 'edit_entry',
        payload: {entryId: 'entry-1', ...payload},
      });

    // Hold the first op in flight; an edit made meanwhile is its own op.
    // Then lose the first op without the server ever seeing it, and keep the
    // queue from retrying so the rolled-back op stays at the head.
    let resolveHeld: (held: {secondId?: string; queued: unknown[]}) => void;
    const held = new Promise<{secondId?: string; queued: unknown[]}>(
      resolve => {
        resolveHeld = resolve;
      },
    );
    await page.route('**/v1/sessions/ops', async route => {
      const id = await edit({count: 2});
      const queuedIds = (await getQueuedSessionOps(page)).map(request => [
        request.data?.opId,
        request.isOngoing ?? false,
      ]);
      await setForceOffline(page, true);
      await route.abort('connectionreset');
      resolveHeld({secondId: id, queued: queuedIds});
    });
    const firstId = await edit({count: 1, note: 'first'});
    const {secondId, queued: inFlightQueue} = await held;

    expect(secondId).toEqual(expect.any(String));
    expect(inFlightQueue).toEqual([
      [firstId, true],
      [secondId, false],
    ]);
    await expect
      .poll(async () =>
        (await getQueuedSessionOps(page)).map(request => [
          request.data?.opId,
          request.isRollbacked ?? false,
        ]),
      )
      .toEqual([
        [firstId, true],
        [secondId, false],
      ]);

    // A third edit folds into the latest queued op (the second), never into
    // the rolled-back first, which keeps its own id and payload.
    const thirdId = await edit({count: 3});
    const queued = await getQueuedSessionOps(page);
    expect(queued.map(request => request.data?.opId)).toEqual([
      firstId,
      thirdId,
    ]);
    expect(queued[0].data).toMatchObject({
      opId: firstId,
      idempotencyKey: firstId,
      payload: {entryId: 'entry-1', count: 1, note: 'first'},
    });
    expect(queued[1].data).toMatchObject({
      opId: thirdId,
      idempotencyKey: thirdId,
      payload: {entryId: 'entry-1', count: 3},
    });
  });
});

/**
 * W2's solo write path: with `SESSION_OPS` and `SESSIONS_V2_SCHEMA` both on, a
 * whole session driven through the UI goes out as ops and never as a
 * whole-session upsert. Needs a kiroku-api that APPLIES the solo ops
 * (kiroku-api#157); against an older backend the `start` op is answered "not
 * implemented" and the spec skips.
 */
test.describe('session ops: the solo write path', () => {
  /** Boot with both W2 flags on. */
  async function bootWithSoloOps(page: Page): Promise<void> {
    await bootWithSessionOps(page);
    await page.evaluate(() => {
      window.kirokuE2E?.setFeatureFlag('SESSIONS_V2_SCHEMA', true);
    });
  }

  /** The op envelopes that reached the server, in order. */
  function opTypes(requests: Array<{postDataJSON: () => unknown}>): string[] {
    return requests.map(
      request => (request.postDataJSON() as {type: string}).type,
    );
  }

  test('starts, logs and ends a session entirely through ops', async ({
    authedPage: page,
  }) => {
    test.setTimeout(180_000);
    const session = new SessionPage(page);
    await bootWithSoloOps(page);

    const sentOps = recordSessionOpRequests(page);
    const upserts: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/v1/sessions/update')) {
        upserts.push(request.url());
      }
    });

    // `start` is the first op of the session; a backend that does not apply it
    // yet answers 422 and there is nothing further to test here.
    const started = waitForOpResponse(page);
    await session.startLiveSession();
    const sessionId = session.currentSessionId();
    let isDeleted = false;
    try {
      const startResponse = await started;
      test.skip(
        startResponse.status() === 422,
        'Needs a kiroku-api that applies the solo session ops (kiroku-api#157).',
      );
      expect(startResponse.status()).toBe(200);
      expect(opBody(startResponse.request())).toMatchObject({type: 'start'});

      // A drink is one `add_entry` carrying an id and this platform's source.
      const added = waitForOpResponse(page);
      await session.logOneDrink();
      const addResponse = await added;
      expect(addResponse.status()).toBe(200);
      const addBody = opBody(addResponse.request()) as {
        type: string;
        payload: {entryId: string; source: string; count: number};
      };
      expect(addBody.type).toBe('add_entry');
      expect(addBody.payload.entryId).toEqual(expect.any(String));
      expect(addBody.payload.source).toBe('web');
      expect(addBody.payload.count).toBe(1);

      // Saving closes the session with `end`, not with a whole-session write.
      const ended = page.waitForResponse(
        response =>
          isSessionOpRequest(response.request()) &&
          (opBody(response.request()) as {type: string}).type === 'end',
        {timeout: 30_000},
      );
      await session.saveButton().click();
      await session.summaryScreen().waitFor({state: 'visible'});
      const endResponse = await ended;
      expect(endResponse.status()).toBe(200);

      // Every write of this session was an op. `/v1/sessions/delete` is still
      // the delete path (there is no delete-session op), so only `update` has
      // to be absent.
      expect(opTypes(sentOps)).toEqual(
        expect.arrayContaining(['start', 'add_entry', 'end']),
      );
      expect(upserts).toEqual([]);
      await expect.poll(() => getQueuedSessionOps(page)).toEqual([]);

      // The saved session reads back with its entry, through the adapter.
      await session.openEditFromSummary();
      await expect(session.totalUnits()).not.toHaveText('0');

      const deleted = page.waitForResponse(
        response =>
          response.url().includes('/v1/sessions/delete') && response.ok(),
      );
      await session.discardButton().click();
      await session.confirmYesButton().click();
      await deleted;
      isDeleted = true;
    } finally {
      if (!isDeleted) {
        await deleteLeftoverSession(page, sessionId);
      }
    }
  });

  test('keeps an offline burst of drinks and drains it in order on reconnect', async ({
    authedPage: page,
  }) => {
    test.setTimeout(180_000);
    const session = new SessionPage(page);
    await bootWithSoloOps(page);

    const started = waitForOpResponse(page);
    await session.startLiveSession();
    const sessionId = session.currentSessionId();
    let isDeleted = false;
    try {
      const startResponse = await started;
      test.skip(
        startResponse.status() === 422,
        'Needs a kiroku-api that applies the solo session ops (kiroku-api#157).',
      );

      // Offline: three taps, each its own op, none of them lost and none of
      // them folded into another (distinct entries, distinct ids).
      await setForceOffline(page, true);
      await session.logOneDrink();
      await session.logOneDrink();
      await session.logOneDrink();
      await expect.poll(() => getQueuedSessionOps(page)).toHaveLength(3);
      const queued = await getQueuedSessionOps(page);
      const queuedIds = queued.map(
        request =>
          (request.data?.payload as {entryId?: string} | undefined)?.entryId,
      );
      expect(new Set(queuedIds).size).toBe(3);
      expect(
        queued.map(request => request.data?.type as string | undefined),
      ).toEqual(['add_entry', 'add_entry', 'add_entry']);

      const sentOps = recordSessionOpRequests(page);
      await setForceOffline(page, false);
      await expect
        .poll(() => getQueuedSessionOps(page), {timeout: 60_000})
        .toEqual([]);

      // They went out in the order they were made, under their own ids.
      const sentIds = sentOps.map(
        request =>
          (opBody(request) as {payload: {entryId?: string}}).payload.entryId,
      );
      expect(sentIds).toEqual(queuedIds);

      const deleted = page.waitForResponse(
        response =>
          response.url().includes('/v1/sessions/delete') && response.ok(),
      );
      await session.discardButton().click();
      await session.confirmYesButton().click();
      await deleted;
      isDeleted = true;
    } finally {
      if (!isDeleted) {
        await deleteLeftoverSession(page, sessionId);
      }
    }
  });
});
