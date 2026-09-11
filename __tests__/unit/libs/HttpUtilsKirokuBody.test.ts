/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

/**
 * `buildKirokuBody` strips transport-internal request fields (including the
 * legacy `platform` that enhanceParameters injects into every request) from
 * kiroku-api JSON bodies. Command params must therefore never be named after
 * one of those fields; this pins that the push registration's platform
 * survives under `devicePlatform`.
 */
import {buildKirokuBody} from '@libs/HttpUtils';

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {connect: jest.fn(), disconnect: jest.fn()},
}));

jest.mock('@libs/Firebase/FirebaseApp', () => ({
  getFirebaseAuth: () => ({currentUser: null}),
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

describe('buildKirokuBody', () => {
  it('keeps devicePlatform and strips the legacy platform field', () => {
    const body = buildKirokuBody({
      token: 'token-1',
      devicePlatform: 'ios',
      deviceID: 'device-1',
      locale: 'en',
      // Added to every request by enhanceParameters
      platform: 'iOS',
      authToken: 'auth-token',
      appversion: '1.0.0',
    });

    expect(body).toEqual({
      token: 'token-1',
      devicePlatform: 'ios',
      deviceID: 'device-1',
      locale: 'en',
    });
  });

  it('drops undefined values', () => {
    expect(buildKirokuBody({token: 'token-1', locale: undefined})).toEqual({
      token: 'token-1',
    });
  });
});
