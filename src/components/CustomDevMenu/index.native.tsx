import React, {useEffect} from 'react';
import {DevSettings} from 'react-native';
import Onyx from 'react-native-onyx';
import {setShouldForceOffline} from '@userActions/Network';
import toggleTestToolsModal from '@userActions/TestTool';
import type CustomDevMenuElement from './types';

const CustomDevMenu: CustomDevMenuElement = Object.assign(
  () => {
    useEffect(() => {
      DevSettings.addMenuItem('Open Test Preferences', toggleTestToolsModal);
      DevSettings.addMenuItem('Clear Onyx', () => {
        // Reload only after the wipe lands, so the next mount hydrates from
        // empty storage (matches a cold install from Onyx's perspective).
        // Firebase Auth keeps its own session, so the user stays signed in
        // — useful for testing one-time-hydration paths like the
        // earliest_session_at backfill without re-doing the sign-in dance.
        Onyx.clear().finally(() => DevSettings.reload());
      });
      // Force the whole app offline without cutting the device's real
      // connection. This flips the `shouldForceOffline` flag that
      // NetworkStore, HttpUtils and Pusher all honor, so requests queue and
      // the offline UI / optimistic-rollback behave exactly as if the network
      // were down — the supported way to exercise the offline-first flows.
      DevSettings.addMenuItem('Force offline', () => {
        setShouldForceOffline(true);
      });
      DevSettings.addMenuItem('Go back online', () => {
        setShouldForceOffline(false);
      });
    }, []);
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <></>;
  },
  {
    displayName: 'CustomDevMenu',
  },
);

export default CustomDevMenu;
