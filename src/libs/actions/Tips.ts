import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';

/**
 * Bumps the device-local count of tips given. Cosmetic only: it drives the
 * thank-you line on the Support screen, nothing reads it to decide what the
 * user may do, and losing it (reinstall, new device) costs the user nothing.
 * The caller passes the current count, read via `useOnyx(ONYXKEYS.TIPS_GIVEN)`.
 */
function recordTipGiven(currentTipsGiven: number) {
  Onyx.set(ONYXKEYS.TIPS_GIVEN, currentTipsGiven + 1);
}

export default recordTipGiven;
