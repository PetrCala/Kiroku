import Onyx from 'react-native-onyx';
import Navigation from '@libs/Navigation/Navigation';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';

/**
 * The one gated ask for the tip jar on Home. The rules live in
 * `@libs/TipJarPromptUtils`; this file owns the writes to
 * `ONYXKEYS.TIP_JAR_PROMPT` and the in-memory "moment" flag.
 */

/**
 * Whether a session summary closed since Home last had focus. In memory on
 * purpose: the moment is a pause in this app run, not a fact to remember. If
 * the app dies before Home focuses again, the next summary re-arms it.
 */
let isMomentArmed = false;

/**
 * Start the 14-day clock, once per device. The caller passes the stored value
 * (from `useOnyx`, once loaded) so a cold start can never overwrite an
 * earlier timestamp with today.
 */
function recordFirstOpen(firstOpenAt: number | undefined): void {
  if (firstOpenAt) {
    return;
  }
  Onyx.merge(ONYXKEYS.TIP_JAR_PROMPT, {firstOpenAt: Date.now()});
}

/** A session summary is closing: the next Home focus is the moment to ask. */
function armMoment(): void {
  isMomentArmed = true;
}

/**
 * Home regained focus. Returns whether a moment was waiting, and clears it
 * either way: an ineligible focus spends the moment rather than carrying it
 * into some later, unrelated screen change.
 */
function consumeMoment(): boolean {
  const wasArmed = isMomentArmed;
  isMomentArmed = false;
  return wasArmed;
}

/** Put the card on Home and count the impression. */
function open(shownCount: number): void {
  Onyx.merge(ONYXKEYS.TIP_JAR_PROMPT, {
    isOpen: true,
    shownCount: shownCount + 1,
    lastShownAt: Date.now(),
  });
}

/** "Buy us a beer": close the card (for the cooldown) and open the Support screen. */
function acceptAndOpenSupport(): void {
  Onyx.merge(ONYXKEYS.TIP_JAR_PROMPT, {isOpen: false});
  Navigation.navigate(ROUTES.SETTINGS_SUPPORT);
}

/** "Not now": the card leaves for the cooldown (120 days) or for good after the last impression. */
function dismiss(): void {
  Onyx.merge(ONYXKEYS.TIP_JAR_PROMPT, {isOpen: false});
}

/** "Don't ask again": the card never returns on this device. */
function dismissForever(): void {
  Onyx.merge(ONYXKEYS.TIP_JAR_PROMPT, {isOpen: false, dismissedForever: true});
}

/**
 * Developer-only shortcuts for the Test Tools panel, so the card can be seen
 * without waiting 14 days. Every one is a no-op in production, like the
 * premium-feature overrides in `@userActions/FeatureAccess`.
 */

/** Put the card on Home right away (the tip, supporter, and live-session gates still apply). */
function devShowNow(): void {
  if (CONFIG.IS_IN_PRODUCTION) {
    return;
  }
  const now = Date.now();
  Onyx.set(ONYXKEYS.TIP_JAR_PROMPT, {
    firstOpenAt: now - CONST.TIP_JAR_PROMPT.MIN_MS_SINCE_FIRST_OPEN,
    shownCount: 1,
    lastShownAt: now,
    isOpen: true,
    dismissedForever: false,
  });
}

/**
 * Backdate the first open past the 14-day gate, forget every impression and
 * dismissal, and arm the moment, so the real open path runs on Home's next
 * focus or data change. Still needs 5 sessions and no tip on this device.
 */
function devMakeEligible(): void {
  if (CONFIG.IS_IN_PRODUCTION) {
    return;
  }
  Onyx.set(ONYXKEYS.TIP_JAR_PROMPT, {
    firstOpenAt: Date.now() - CONST.TIP_JAR_PROMPT.MIN_MS_SINCE_FIRST_OPEN,
    shownCount: 0,
  });
  armMoment();
}

/** Forget the card's state, as on a fresh install (the clock restarts on the next Home render). */
function devReset(): void {
  if (CONFIG.IS_IN_PRODUCTION) {
    return;
  }
  Onyx.set(ONYXKEYS.TIP_JAR_PROMPT, null);
}

export {
  recordFirstOpen,
  armMoment,
  consumeMoment,
  open,
  acceptAndOpenSupport,
  dismiss,
  dismissForever,
  devShowNow,
  devMakeEligible,
  devReset,
};
