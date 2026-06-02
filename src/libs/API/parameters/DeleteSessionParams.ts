import type {DrinkingSessionId} from '@src/types/onyx';

type DeleteSessionParams = {
  /** ID of the session to remove (its GPS locations are removed too). */
  sessionId: DrinkingSessionId;
  /** When true, the server also clears the user's live status. */
  sessionIsLive?: boolean;
};

export default DeleteSessionParams;
