import {expect, type Page, type Request, type Response} from '@playwright/test';

/**
 * Typed access to the page hooks the app installs on dev builds
 * (`src/libs/E2EHooks/index.website.ts`): `npm run web` and the PR preview
 * channel. Production, staging and adhoc builds don't have them.
 */

export type OnyxUpdateLike = {
  onyxMethod: 'merge' | 'set';
  key: string;
  value: unknown;
};

export type OnyxDataLike = {
  optimisticData?: OnyxUpdateLike[];
  successData?: OnyxUpdateLike[];
  failureData?: OnyxUpdateLike[];
};

export type SessionOpInput = {
  sessionId: string;
  type: string;
  payload?: Record<string, unknown>;
};

/** A request in the app's queue; the one in flight comes first, `isOngoing`. */
export type QueuedRequest = {
  command: string;
  data?: Record<string, unknown>;
  isRollbacked?: boolean;
  isOngoing?: boolean;
};

type E2EHooks = {
  setFeatureFlag: (flag: string, value: boolean | undefined) => void;
  sendSessionOp: (
    op: SessionOpInput,
    onyxData?: OnyxDataLike,
  ) => string | undefined;
  getServerTime: () => number;
  getApiRoot: () => string;
  setShouldForceOffline: (shouldForceOffline: boolean) => void;
  isOffline: () => boolean;
  setTimeSkew: (skew: number) => void;
  getQueuedRequests: () => QueuedRequest[];
  getOnyxValue: (key: string) => Promise<unknown>;
};

declare global {
  interface Window {
    kirokuE2E?: E2EHooks;
  }
}

/** `WRITE_COMMANDS.SESSION_OP`, sent as `POST /v1/sessions/ops`. */
export const SESSION_OP_COMMAND = 'SessionOp';
const SESSION_OPS_PATH = '/v1/sessions/ops';

/** OpenApp and ReconnectApp, the requests that refresh the server-time offset. */
const BOOTSTRAP_PATH = '/v1/app/open';

/**
 * An Onyx key no app code reads, for asserting which of an op's optimistic,
 * success and failure data the queue applied. It lives in the test's own
 * browser context, so it goes away with it.
 */
export const OP_MARKER_KEY = 'e2eSessionOpMarker';

export function markerData(): OnyxDataLike {
  const mark = (state: string): OnyxUpdateLike[] => [
    {onyxMethod: 'merge', key: OP_MARKER_KEY, value: {state}},
  ];
  return {
    optimisticData: mark('pending'),
    successData: mark('succeeded'),
    failureData: mark('failed'),
  };
}

export function isSessionOpRequest(request: Request): boolean {
  return (
    request.method() === 'POST' && request.url().includes(SESSION_OPS_PATH)
  );
}

export function isBootstrapResponse(response: Response): boolean {
  return (
    response.request().method() === 'GET' &&
    response.url().includes(BOOTSTRAP_PATH)
  );
}

/** Collect every session op request the page sends from now on. */
export function recordSessionOpRequests(page: Page): Request[] {
  const requests: Request[] = [];
  page.on('request', request => {
    if (isSessionOpRequest(request)) {
      requests.push(request);
    }
  });
  return requests;
}

/** The op envelope a request carried (`opId`, `type`, `payload`, ...). */
export function opBody(request: Request): Record<string, unknown> {
  return request.postDataJSON() as Record<string, unknown>;
}

export function hasE2EHooks(page: Page): Promise<boolean> {
  return page.evaluate(() => window.kirokuE2E !== undefined);
}

export function setSessionOpsEnabled(
  page: Page,
  enabled: boolean | undefined,
): Promise<void> {
  return page.evaluate(value => {
    window.kirokuE2E?.setFeatureFlag('SESSION_OPS', value);
  }, enabled);
}

export function sendSessionOp(
  page: Page,
  op: SessionOpInput,
  onyxData?: OnyxDataLike,
): Promise<string | undefined> {
  return page.evaluate(
    ([input, data]) => window.kirokuE2E?.sendSessionOp(input, data),
    [op, onyxData] as const,
  );
}

/**
 * Force the app offline (or back online) and wait until its network store
 * says so: the flag goes through Onyx, and an op sent before the store flips
 * would still go out.
 */
export async function setForceOffline(
  page: Page,
  shouldForceOffline: boolean,
): Promise<void> {
  await page.evaluate(value => {
    window.kirokuE2E?.setShouldForceOffline(value);
  }, shouldForceOffline);
  await expect
    .poll(() => page.evaluate(() => window.kirokuE2E?.isOffline()))
    .toBe(shouldForceOffline);
}

export function setTimeSkew(page: Page, skew: number): Promise<void> {
  return page.evaluate(value => {
    window.kirokuE2E?.setTimeSkew(value);
  }, skew);
}

export function getQueuedRequests(page: Page): Promise<QueuedRequest[]> {
  return page.evaluate(() => window.kirokuE2E?.getQueuedRequests() ?? []);
}

export async function getQueuedSessionOps(
  page: Page,
): Promise<QueuedRequest[]> {
  const queued = await getQueuedRequests(page);
  return queued.filter(request => request.command === SESSION_OP_COMMAND);
}

export function getOnyxValue(page: Page, key: string): Promise<unknown> {
  return page.evaluate(k => window.kirokuE2E?.getOnyxValue(k), key);
}

/** `NETWORK.timeSkew`, the measured server-time offset (ms). */
export async function getTimeSkew(page: Page): Promise<number | undefined> {
  const network = (await getOnyxValue(page, 'network')) as
    | {timeSkew?: number}
    | undefined;
  return network?.timeSkew;
}

/**
 * The offset `DateUtils.getServerTime()` applies, bracketed by the page clock
 * read just before and after it: `[low, high]` contains the offset exactly.
 */
export function getServerTimeOffset(
  page: Page,
): Promise<{low: number; high: number; serverTime: number}> {
  return page.evaluate(() => {
    const before = Date.now();
    const serverTime = window.kirokuE2E?.getServerTime() ?? NaN;
    const after = Date.now();
    return {low: serverTime - after, high: serverTime - before, serverTime};
  });
}
