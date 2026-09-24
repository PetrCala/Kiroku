import {getKirokuRoute} from '@libs/API/kirokuRoutes';
import {WRITE_COMMANDS} from '@libs/API/types';

describe('ReconnectApp route', () => {
  const route = getKirokuRoute(WRITE_COMMANDS.RECONNECT_APP);

  it('asks /v1/app/open for just the missed updates when the client has a baseline', () => {
    expect(route?.method).toBe('get');
    expect(route?.path).toBe('/v1/app/open');
    expect(route?.toQuery?.({updateIDFrom: 42})).toEqual({updateIDFrom: 42});
  });

  it('asks for the full payload when the client has no baseline', () => {
    expect(route?.toQuery?.({})).toEqual({});
    expect(route?.toQuery?.({updateIDFrom: 0})).toEqual({});
  });

  it('carries the sessions snapshot floor for a full re-baseline', () => {
    expect(route?.toQuery?.({updateIDFrom: 42, sessionsFrom: 1000})).toEqual({
      updateIDFrom: 42,
      sessionsFrom: 1000,
    });
    // Non-positive means the whole history, the pre-window contract.
    expect(route?.toQuery?.({sessionsFrom: 0})).toEqual({});
  });
});

describe('OpenApp route', () => {
  const route = getKirokuRoute(WRITE_COMMANDS.OPEN_APP);

  it('windows the sessions snapshot to sessionsFrom', () => {
    expect(route?.method).toBe('get');
    expect(route?.path).toBe('/v1/app/open');
    expect(
      route?.toQuery?.({enablePriorityModeFilter: true, sessionsFrom: 1000.9}),
    ).toEqual({sessionsFrom: 1000});
  });

  it('asks for the whole history without a floor', () => {
    expect(route?.toQuery?.({enablePriorityModeFilter: true})).toEqual({});
  });
});
