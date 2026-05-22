// Web no-op — react-native-performance only emits native cold-start marks
// on the native platforms.
import type StartupMetrics from './types';

const startupMetrics: StartupMetrics = {
  init: () => {},
};

export default startupMetrics;
