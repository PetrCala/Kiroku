/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

/**
 * `API.write` mints an idempotency key into each request's data. `HttpUtils`
 * must send it to kiroku-api as the `Idempotency-Key` header on writes, keep it
 * out of the JSON body, and leave GET routes and keyless requests (queued by an
 * older build) without the header.
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

const KEY = '5f0c1a52-7c1e-4d0b-9a55-0d6b2f4f1e01';

type SentRequest = {url: string; init: RequestInit};

function mockFetchOk(sent: SentRequest[]) {
  global.fetch = jest.fn((url: string, init: RequestInit) => {
    sent.push({url, init});
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {get: () => null},
      json: () => Promise.resolve({jsonCode: 200, onyxData: []}),
    });
  }) as unknown as typeof fetch;
}

describe('HttpUtils idempotency key', () => {
  let HttpUtils: typeof HttpUtilsType;
  let WRITE_COMMANDS: typeof WriteCommands;
  let sent: SentRequest[];

  beforeEach(() => {
    jest.resetModules();
    HttpUtils = (require('@libs/HttpUtils') as {default: typeof HttpUtilsType})
      .default;
    WRITE_COMMANDS = (
      require('@libs/API/types') as {WRITE_COMMANDS: typeof WriteCommands}
    ).WRITE_COMMANDS;
    sent = [];
    mockFetchOk(sent);
  });

  it('sends the key as a header on a write and keeps it out of the body', async () => {
    await HttpUtils.xhr(WRITE_COMMANDS.UPDATE_SESSION, {
      sessionId: 's1',
      session: {start_time: 1},
      idempotencyKey: KEY,
    });

    const {init} = sent[0];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(
      KEY,
    );
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty('idempotencyKey');
    expect(body.sessionId).toBe('s1');
  });

  it('sends no key on a GET route', async () => {
    await HttpUtils.xhr(WRITE_COMMANDS.OPEN_APP, {idempotencyKey: KEY});

    const {url, init} = sent[0];
    expect(init.headers as Record<string, string>).not.toHaveProperty(
      'Idempotency-Key',
    );
    expect(url).not.toContain(KEY);
  });

  it('sends no header for a write queued by an older build without a key', async () => {
    await HttpUtils.xhr(WRITE_COMMANDS.UPDATE_SESSION, {
      sessionId: 's1',
      session: {start_time: 1},
    });

    expect(sent[0].init.headers as Record<string, string>).not.toHaveProperty(
      'Idempotency-Key',
    );
  });
});
