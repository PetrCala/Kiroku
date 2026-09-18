import type {DrinkProfile} from '@libs/DrinkRanking/types';
import type {
  DrinkingSession,
  DrinkingSessionId,
  Preferences,
} from '@src/types/onyx';

type DrinkingSessionOverviewProps = {
  sessionId: DrinkingSessionId;
  session: DrinkingSession;
  isEditModeOn: boolean;

  /** Render as a non-interactive tile: no navigation into the session summary,
   *  no edit/ongoing buttons. Used for viewing a friend's sessions. */
  readOnly?: boolean;

  /** Open the session for editing on a long-press — a shortcut that mirrors the
   *  Edit/Done toggle's edit button without entering edit mode. No-op for
   *  read-only (friend) tiles and ongoing sessions, which can't be edited. */
  enableLongPressToEdit?: boolean;

  /** Preferences to use for color/unit computation. Falls back to the current
   *  user's preferences when omitted — pass the viewed user's preferences when
   *  rendering someone else's session. */
  preferences?: Preferences;

  /** The signed-in user's drink profile, which orders the drink-type strip.
   *  Required rather than read here, because building it walks the whole
   *  session list and these tiles are rendered in lists: the list reads it once
   *  with `useDrinkProfile` and passes it to every tile. It is always the
   *  viewer's own profile, including on someone else's session, since the
   *  order is how the viewer reads a session, not a property of it. */
  drinkProfile: DrinkProfile;
};

export default DrinkingSessionOverviewProps;
