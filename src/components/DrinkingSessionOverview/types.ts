import type {DrinkingSession, DrinkingSessionId} from '@src/types/onyx';
import type {Route} from '@src/ROUTES';

type DrinkingSessionOverviewProps = {
  sessionId: DrinkingSessionId;
  session: DrinkingSession;
  isEditModeOn: boolean;

  /** Route to return to when leaving the ongoing session screen */
  backTo?: Route;
};

export default DrinkingSessionOverviewProps;
