/**
 * Live-session lock-screen surface, native-only (see `./index.ios.ts` and
 * `./index.android.ts`). On web, and under jest where no native module exists,
 * there is nothing to show, so every call is a no-op.
 */
import type {LiveActivityModule} from './types';

const LiveActivity: LiveActivityModule = {
  start: () => {},
  update: () => {},
  end: () => {},
};

export default LiveActivity;
