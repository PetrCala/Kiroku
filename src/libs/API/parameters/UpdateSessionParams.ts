import type {DrinkingSession, DrinkingSessionId} from '@src/types/onyx';

type UpdateSessionParams = {
  /** ID of the session being upserted (also its key under the user's sessions). */
  sessionId: DrinkingSessionId;
  /** The full drinking-session payload to write (server stores it verbatim). */
  session: DrinkingSession;
  /** When true, the server also mirrors the session into the user's live status. */
  sessionIsLive?: boolean;
};

export default UpdateSessionParams;
