import type LogType from '@libs/Log';

/**
 * `Log`'s client callback is the only client sink this fork has, and a release
 * bundle deletes every `console.debug` in it. Which console method a line takes
 * is therefore the difference between an ad-hoc build that can be debugged and
 * one that logs nothing, so it is worth pinning down.
 */
const mockIsInAdhoc = {value: false};

jest.mock('@src/CONFIG', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __esModule: true,
  default: new Proxy(
    {},
    {
      get: (_target, prop) =>
        prop === 'IS_IN_ADHOC' ? mockIsInAdhoc.value : undefined,
    },
  ),
}));

jest.mock('@libs/actions/Console', () => ({
  addLog: jest.fn(),
  flushAllLogsOnAppLaunch: () => Promise.resolve(),
}));

const flushPromises = () =>
  new Promise(resolve => {
    process.nextTick(resolve);
  });

function loadLog(isInAdhoc: boolean): typeof LogType {
  mockIsInAdhoc.value = isInAdhoc;
  let log: typeof LogType | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports
    log = (require('@libs/Log') as {default: typeof LogType}).default;
  });
  if (!log) {
    throw new Error('Log did not load');
  }
  return log;
}

const messages = (spy: jest.SpyInstance): string[] =>
  (spy.mock.calls as unknown[][]).map(call => String(call[0]));

describe('Log console sink', () => {
  let warnSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it('surfaces alerts through console.warn on an ad-hoc build', async () => {
    const Log = loadLog(true);

    Log.alert('[BootSplash] something got stuck', {}, false);
    await flushPromises();

    expect(
      messages(warnSpy).filter(message => message.startsWith('[alrt]')),
    ).toHaveLength(1);
  });

  it('surfaces warns too', async () => {
    const Log = loadLog(true);

    Log.warn('a warning worth reading in the field');
    await flushPromises();

    expect(
      messages(warnSpy).filter(message => message.startsWith('[warn]')),
    ).toHaveLength(1);
  });

  it('leaves the chatty levels on console.debug, so an ad-hoc log still reads like production', async () => {
    const Log = loadLog(true);

    Log.info('routine startup chatter');
    Log.hmmm('something mildly odd');
    await flushPromises();

    expect(messages(warnSpy)).toHaveLength(0);
    expect(
      messages(debugSpy).some(message => message.startsWith('[info]')),
    ).toBe(true);
    expect(
      messages(debugSpy).some(message => message.startsWith('[hmmm]')),
    ).toBe(true);
  });

  it('changes nothing off an ad-hoc build, where a release bundle strips the line', async () => {
    const Log = loadLog(false);

    Log.alert('[BootSplash] something got stuck', {}, false);
    await flushPromises();

    expect(messages(warnSpy)).toHaveLength(0);
    expect(
      messages(debugSpy).filter(message => message.startsWith('[alrt]')),
    ).toHaveLength(1);
  });
});
