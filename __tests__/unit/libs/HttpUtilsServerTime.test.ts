/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

/**
 * The server-time offset: HttpUtils measures it from the bootstrap responses
 * (`OpenApp`, `ReconnectApp`), preferring kiroku-api's millisecond
 * `X-Server-Time` and falling back to the whole-second `Date` header, and
 * centers the server's reading on the request's round trip.
 */
import type {
  SIDE_EFFECT_REQUEST_COMMANDS as SideEffectCommands,
  WRITE_COMMANDS as WriteCommands,
} from '@libs/API/types';
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

// A whole second, so a `Date` header can represent it exactly.
const NOW = 1_700_000_000_000;

function mockFetchWithHeaders(headers: Record<string, string>) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {get: (name: string) => headers[name] ?? null},
      json: () => Promise.resolve({jsonCode: 200, onyxData: []}),
    }),
  ) as unknown as typeof fetch;
}

describe('HttpUtils server-time offset', () => {
  let HttpUtils: typeof HttpUtilsType;
  let WRITE_COMMANDS: typeof WriteCommands;
  let SIDE_EFFECT_REQUEST_COMMANDS: typeof SideEffectCommands;
  let setTimeSkew: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    HttpUtils = (require('@libs/HttpUtils') as {default: typeof HttpUtilsType})
      .default;
    ({WRITE_COMMANDS, SIDE_EFFECT_REQUEST_COMMANDS} =
      require('@libs/API/types') as {
        WRITE_COMMANDS: typeof WriteCommands;
        SIDE_EFFECT_REQUEST_COMMANDS: typeof SideEffectCommands;
      });
    setTimeSkew = (require('@userActions/Network') as {setTimeSkew: jest.Mock})
      .setTimeSkew;
    setTimeSkew.mockClear();
    // The request and the response land at the same device instant.
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('measures the offset from X-Server-Time on OpenApp', async () => {
    mockFetchWithHeaders({'X-Server-Time': String(NOW + 60_000)});
    await HttpUtils.xhr(WRITE_COMMANDS.OPEN_APP, {});
    expect(setTimeSkew).toHaveBeenCalledWith(60_000);
  });

  it('measures a device clock that runs ahead as a negative offset', async () => {
    mockFetchWithHeaders({'X-Server-Time': String(NOW - 5_000)});
    await HttpUtils.xhr(SIDE_EFFECT_REQUEST_COMMANDS.RECONNECT_APP, {});
    expect(setTimeSkew).toHaveBeenCalledWith(-5_000);
  });

  it('falls back to the Date header, centered on its second', async () => {
    mockFetchWithHeaders({Date: new Date(NOW + 60_000).toUTCString()});
    await HttpUtils.xhr(WRITE_COMMANDS.OPEN_APP, {});
    expect(setTimeSkew).toHaveBeenCalledWith(60_500);
  });

  it('leaves the offset alone when the response carries no clock', async () => {
    mockFetchWithHeaders({});
    await HttpUtils.xhr(WRITE_COMMANDS.OPEN_APP, {});
    expect(setTimeSkew).not.toHaveBeenCalled();
  });

  it('only measures on the bootstrap requests', async () => {
    mockFetchWithHeaders({'X-Server-Time': String(NOW + 60_000)});
    await HttpUtils.xhr(WRITE_COMMANDS.UPDATE_SESSION, {
      sessionId: 's1',
      session: {start_time: 1},
    });
    expect(setTimeSkew).not.toHaveBeenCalled();
  });
});
