// import {NativeModules} from 'react-native';
import type StartupTimer from './types';

/**
 * Stop the startup trace for the app.
 */
const startupTimer: StartupTimer = {
  stop: () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    // NativeModules.StartupTimer.stop(); // TODO
  },
};

export default startupTimer;
