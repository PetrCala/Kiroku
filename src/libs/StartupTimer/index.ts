/**
 * Web noop as there is no "startup" to time from the native layer.
 */
import type StartupTimer from './types';

const startupTimer: StartupTimer = {
  stop: () => {},
};

export default startupTimer;
