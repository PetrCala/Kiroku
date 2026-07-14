/**
 * @jest-environment node
 */

import {deriveConnectivity} from '@context/global/UserConnectionContext';
import CONST from '@src/CONST';

const {ONLINE, OFFLINE, UNKNOWN} = CONST.NETWORK.NETWORK_STATUS;

describe('deriveConnectivity', () => {
  it('pins emulator/local dev online regardless of NetInfo state', () => {
    expect(
      deriveConnectivity(
        {isConnected: false, isInternetReachable: false},
        true,
      ),
    ).toEqual({isOffline: false, isDetermined: true, networkStatus: ONLINE});
  });

  it('treats a fully undetermined state as neither online nor offline', () => {
    // iOS cold start delivers this before reachability resolves. It must not
    // read as offline (no false indicator flash), but it must also report
    // undetermined so the provider keeps rechecking instead of latching
    // "online" forever when the app was launched already in airplane mode.
    expect(
      deriveConnectivity({isConnected: null, isInternetReachable: null}, false),
    ).toEqual({isOffline: false, isDetermined: false, networkStatus: UNKNOWN});
  });

  it('is offline when there is no network interface', () => {
    expect(
      deriveConnectivity(
        {isConnected: false, isInternetReachable: null},
        false,
      ),
    ).toEqual({isOffline: true, isDetermined: true, networkStatus: OFFLINE});
  });

  it('is offline on a network without internet access', () => {
    // Captive portal / dead wifi: connected to an interface, but the internet
    // reachability probe failed. The old `isConnected`-only mapping missed this.
    expect(
      deriveConnectivity(
        {isConnected: true, isInternetReachable: false},
        false,
      ),
    ).toEqual({isOffline: true, isDetermined: true, networkStatus: OFFLINE});
  });

  it('is online when connected with reachable internet', () => {
    expect(
      deriveConnectivity({isConnected: true, isInternetReachable: true}, false),
    ).toEqual({isOffline: false, isDetermined: true, networkStatus: ONLINE});
  });

  it('is online (determined) when connected while reachability is still resolving', () => {
    expect(
      deriveConnectivity({isConnected: true, isInternetReachable: null}, false),
    ).toEqual({isOffline: false, isDetermined: true, networkStatus: ONLINE});
  });
});
