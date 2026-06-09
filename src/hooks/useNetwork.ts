import {useContext, useEffect, useRef} from 'react';
import {NetworkContext} from '@components/OnyxProvider';
import CONST from '@src/CONST';

type UseNetworkProps = {
  onReconnect?: () => void;
};

type UseNetwork = {isOffline: boolean};

export default function useNetwork({
  onReconnect = () => {},
}: UseNetworkProps = {}): UseNetwork {
  const callback = useRef(onReconnect);
  callback.current = onReconnect;

  const network = useContext(NetworkContext);
  const networkStatus =
    network?.networkStatus ?? CONST.NETWORK.NETWORK_STATUS.UNKNOWN;
  const isOffline = network?.isOffline ?? CONST.DEFAULT_NETWORK_DATA.isOffline;
  const shouldForceOffline = network?.shouldForceOffline ?? false;

  // The dev-menu "Force offline"/"Go back online" toggles only flip the
  // `shouldForceOffline` flag, so the offline UI has to honor it symmetrically.
  // Reading it here (instead of relying on a side-channel that writes
  // `isOffline`) keeps the indicator in lock-step with the toggle in both
  // directions and mirrors NetworkStore.isOffline() (`shouldForceOffline ||
  // isOffline`). When the real network status is still UNKNOWN we don't treat it
  // as offline.
  const isNetworkStatusUnknown =
    networkStatus === CONST.NETWORK.NETWORK_STATUS.UNKNOWN;
  const isOfflineEffective =
    shouldForceOffline || (!isNetworkStatusUnknown && isOffline);

  const prevOfflineStatusRef = useRef(isOfflineEffective);
  useEffect(() => {
    // If we were offline before and now we are not offline then we just reconnected
    const didReconnect = prevOfflineStatusRef.current && !isOfflineEffective;
    if (!didReconnect) {
      return;
    }

    callback.current();
  }, [isOfflineEffective]);

  useEffect(() => {
    // Used to store previous prop values to compare on next render
    prevOfflineStatusRef.current = isOfflineEffective;
  }, [isOfflineEffective]);

  return {isOffline: isOfflineEffective};
}
