import type {OnyxEntry} from 'react-native-onyx';
import CONST from '@src/CONST';
import type {TipJarPrompt} from '@src/types/onyx';

/**
 * Pure rules for the one gated tip-jar ask on Home. Side-effect free (no
 * React, no Onyx, no platform) so the decision matrix is unit-testable; the
 * `TipJarPromptCard` supplies the context. See contributingGuides/TIP_JAR.md.
 */

/** What the rules need to know, gathered by the caller. */
type TipJarPromptState = {
  /** The persisted prompt state; undefined on a device that never had it. */
  prompt: OnyxEntry<TipJarPrompt>;

  /** Completed (not ongoing) drinking sessions of the signed-in user. */
  completedSessionCount: number;

  /** Tips given on this device, ever (`ONYXKEYS.TIPS_GIVEN`). */
  tipsGiven: number;

  /** Whether the user holds an active supporter entitlement. */
  isSupporter: boolean;

  /** Whether a session is live right now. */
  hasOngoingSession: boolean;

  /** Whether this build can sell tips at all (native only; web can't). */
  isTipJarAvailable: boolean;
};

/** The state plus the clock, for the decisions that depend on time. */
type TipJarPromptContext = TipJarPromptState & {
  /** `Date.now()` at the time of the decision. */
  now: number;
};

/**
 * Whether the card may open right now. Every gate must hold: the device has
 * used the app for 14 days and logged 5 sessions (the app delivered value),
 * nothing has been tipped or subscribed, no session is live, the user never
 * said "Don't ask again", fewer than 3 lifetime impressions, and 120 days
 * since the last one. The moment (Home regaining focus after a session summary
 * closed) is the caller's business, not this function's.
 */
function canOpenTipJarPrompt(context: TipJarPromptContext): boolean {
  const {now, prompt, completedSessionCount} = context;
  if (!isTipJarPromptStillWanted(context)) {
    return false;
  }
  if (prompt?.isOpen) {
    return false;
  }
  if (
    !prompt?.firstOpenAt ||
    now - prompt.firstOpenAt < CONST.TIP_JAR_PROMPT.MIN_MS_SINCE_FIRST_OPEN
  ) {
    return false;
  }
  if (completedSessionCount < CONST.TIP_JAR_PROMPT.MIN_COMPLETED_SESSIONS) {
    return false;
  }
  if ((prompt.shownCount ?? 0) >= CONST.TIP_JAR_PROMPT.MAX_IMPRESSIONS) {
    return false;
  }
  if (
    prompt.lastShownAt !== undefined &&
    now - prompt.lastShownAt < CONST.TIP_JAR_PROMPT.COOLDOWN_MS
  ) {
    return false;
  }
  return true;
}

/**
 * Whether an already-open card should still be rendered. It stays on Home
 * until answered, but drops out the moment a tip lands, a subscription
 * starts, a session goes live, or the build cannot sell tips. Needs no clock,
 * so it is safe to call during render.
 */
function shouldShowTipJarPrompt(state: TipJarPromptState): boolean {
  return !!state.prompt?.isOpen && isTipJarPromptStillWanted(state);
}

/** The gates shared by opening and by keeping an open card visible. */
function isTipJarPromptStillWanted({
  prompt,
  tipsGiven,
  isSupporter,
  hasOngoingSession,
  isTipJarAvailable,
}: TipJarPromptState): boolean {
  return (
    isTipJarAvailable &&
    !prompt?.dismissedForever &&
    tipsGiven === 0 &&
    !isSupporter &&
    !hasOngoingSession
  );
}

export {canOpenTipJarPrompt, shouldShowTipJarPrompt};
export type {TipJarPromptContext, TipJarPromptState};
