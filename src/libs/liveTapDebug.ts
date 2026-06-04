// TEMPORARY: device instrumentation for diagnosing live-session tap latency and
// the post-freeze incorrect updates. Remove this file and its imports once the
// issue is understood. Filter Metro logs by "[live-tap]".
/* eslint-disable no-console -- temporary device-debug instrumentation */
import type {DrinksList} from '@src/types/onyx';
import {getDrinkCount} from './DrinkEntryUtils';

const start = Date.now();

/** Total number of drinks across all timestamps in a drinks list. */
function countDrinks(drinks: DrinksList | undefined): number {
  if (!drinks) {
    return 0;
  }
  let total = 0;
  for (const atTimestamp of Object.values(drinks)) {
    for (const entry of Object.values(atTimestamp)) {
      total += getDrinkCount(entry);
    }
  }
  return total;
}

function liveTapLog(label: string, data: Record<string, unknown> = {}): void {
  if (!__DEV__) {
    return;
  }
  console.log(`[live-tap +${Date.now() - start}ms] ${label}`, data);
}

export {countDrinks};
export default liveTapLog;
