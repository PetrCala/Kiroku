import CONST from '@src/CONST';
import type {DrinkingSession, SessionVisibility} from '@src/types/onyx';

/**
 * Per-session visibility (RFC §4.2), the mirror of the server's
 * `lib/sessions/visibility.ts`. It sits on top of the account-wide hiding
 * (`hide_from_all` and the per-friend list): a friend who may see the user's
 * data at all still never sees a session marked private.
 *
 * A session with no `visibility` is `friends`, the RFC's default. Legacy
 * sessions and the sessions the backfill converts carry none, and they were
 * visible to friends before this existed, so absence must not read as private.
 */
function getSessionVisibility(
  session: DrinkingSession | undefined,
): SessionVisibility {
  return session?.visibility === CONST.SESSION.VISIBILITY.PRIVATE
    ? CONST.SESSION.VISIBILITY.PRIVATE
    : CONST.SESSION.VISIBILITY.FRIENDS;
}

/** Whether the session is the user's alone. */
function isSessionPrivate(session: DrinkingSession | undefined): boolean {
  return getSessionVisibility(session) === CONST.SESSION.VISIBILITY.PRIVATE;
}

/** The visibility a private toggle in that position means. */
function visibilityFromIsPrivate(isPrivate: boolean): SessionVisibility {
  return isPrivate
    ? CONST.SESSION.VISIBILITY.PRIVATE
    : CONST.SESSION.VISIBILITY.FRIENDS;
}

export {getSessionVisibility, isSessionPrivate, visibilityFromIsPrivate};
