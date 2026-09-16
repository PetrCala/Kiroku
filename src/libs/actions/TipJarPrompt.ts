import Onyx from 'react-native-onyx';
import Navigation from '@libs/Navigation/Navigation';
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

export {
  recordFirstOpen,
  armMoment,
  consumeMoment,
  open,
  acceptAndOpenSupport,
  dismiss,
  dismissForever,
};
