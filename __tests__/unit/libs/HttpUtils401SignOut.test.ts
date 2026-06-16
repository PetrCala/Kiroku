/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

/**
 * kiroku-api returns a plain HTTP 401 when the caller's Firebase ID token is
 * revoked/disabled/invalid — distinct from `jsonCode` 407 (merely expired),
 * which the Reauthentication middleware refreshes and replays. A refresh cannot
 * recover a revoked token, so `HttpUtils` force-signs-out on a 401 that carried
 * a `Bearer` token. These tests pin that behavior:
 *  - an authenticated 401 signs out once and still rejects the request,
 *  - a burst of concurrent 401s collapses into a single sign-out,
 *  - non-401 failures and 401s with no `Bearer` (legacy transport) do NOT sign out.
 */
import type {WRITE_COMMANDS as WriteCommands} from '@libs/API/types';
import type HttpUtilsType from '@libs/HttpUtils';

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {connect: jest.fn(), disconnect: jest.fn()},
}));

jest.mock('@libs/Firebase/FirebaseApp', () => ({
  getFirebaseAuth: () => ({
    currentUser: {getIdToken: jest.fn(() => Promise.resolve('valid-token'))},
  }),
}));

jest.mock('@userActions/Session', () => ({
  signOut: jest.fn(() => Promise.resolve()),
}));

jest.mock('@libs/ApiUtils', () => ({
  getKirokuApiRoot: () => 'https://api.test',
  getCommandURL: () => 'https://legacy.test/cmd',
}));

jest.mock('@userActions/Network', () => ({setTimeSkew: jest.fn()}));
jest.mock('@userActions/UpdateRequired', () => ({alertUser: jest.fn()}));
jest.mock('@libs/Log', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    alert: jest.fn(),
    hmmm: jest.fn(),
  },
}));

function mockFetchStatus(status: number, statusText: string) {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {get: () => null},
    json: () => Promise.resolve({}),
  };
  global.fetch = jest.fn(() =>
    Promise.resolve(response),
  ) as unknown as typeof fetch;
}

describe('HttpUtils 401 (revoked token) sign-out', () => {
  let HttpUtils: typeof HttpUtilsType;
  let signOut: jest.Mock;
  let WRITE_COMMANDS: typeof WriteCommands;

  beforeEach(() => {
    // Fresh module registry so the module-private "is signing out" guard resets
    // between tests (it re-arms asynchronously, after sign-out settles).
    jest.resetModules();
    HttpUtils = (require('@libs/HttpUtils') as {default: typeof HttpUtilsType})
      .default;
    signOut = (require('@userActions/Session') as {signOut: jest.Mock}).signOut;
    WRITE_COMMANDS = (
      require('@libs/API/types') as {WRITE_COMMANDS: typeof WriteCommands}
    ).WRITE_COMMANDS;
    signOut.mockClear();
    signOut.mockReturnValue(Promise.resolve());
  });

  it('signs out once and still rejects when an authenticated request gets a 401', async () => {
    mockFetchStatus(401, 'Unauthorized');

    await expect(
      HttpUtils.xhr(WRITE_COMMANDS.OPEN_APP, {}),
    ).rejects.toMatchObject({name: 'HttpsError', status: '401'});

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('collapses a burst of concurrent 401s into a single sign-out', async () => {
    mockFetchStatus(401, 'Unauthorized');
    // Keep sign-out pending so the guard never re-arms mid-burst.
    signOut.mockReturnValue(new Promise<void>(() => {}));

    const results = await Promise.allSettled([
      HttpUtils.xhr(WRITE_COMMANDS.OPEN_APP, {}),
      HttpUtils.xhr(WRITE_COMMANDS.OPEN_APP, {}),
      HttpUtils.xhr(WRITE_COMMANDS.OPEN_APP, {}),
    ]);

    expect(results.every(r => r.status === 'rejected')).toBe(true);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('does NOT sign out on a non-401 server failure', async () => {
    mockFetchStatus(500, 'Internal Server Error');

    await expect(
      HttpUtils.xhr(WRITE_COMMANDS.OPEN_APP, {}),
    ).rejects.toBeInstanceOf(Error);

    expect(signOut).not.toHaveBeenCalled();
  });

  it('does NOT sign out on a 401 with no Bearer token (legacy transport)', async () => {
    mockFetchStatus(401, 'Unauthorized');

    // A command absent from the kiroku-api route map falls through to the legacy
    // FormData transport, which sends no Authorization header.
    await expect(HttpUtils.xhr('NotAKirokuCommand', {})).rejects.toMatchObject({
      status: '401',
    });

    expect(signOut).not.toHaveBeenCalled();
  });
});
