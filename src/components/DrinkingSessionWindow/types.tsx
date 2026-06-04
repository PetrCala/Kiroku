import type {OnyxKey} from '@src/ONYXKEYS';
import type {
  DrinkingSession,
  DrinkingSessionId,
  DrinkingSessionType,
} from '@src/types/onyx';
import type CONST from '@src/CONST';
import type DeepValueOf from '@src/types/utils/DeepValueOf';

type DrinkingSessionWindowProps = {
  onNavigateBack: (
    action: DeepValueOf<typeof CONST.NAVIGATION.SESSION_ACTION>,
  ) => void;

  /** The session id */
  sessionId: DrinkingSessionId;

  /** The session data object to show */
  session: DrinkingSession;

  /** The onyx key under which the session data is stored */
  onyxKey: OnyxKey;

  /** Type of the drinking session */
  type: DrinkingSessionType;

  /** Whether to show an indicator of pending db sync changes */
  shouldShowSyncPendingIndicator?: boolean;

  /** Whether to show an indicator of successful db sync changes */
  shouldShowSyncSuccessIndicator?: boolean;
};

export default DrinkingSessionWindowProps;
