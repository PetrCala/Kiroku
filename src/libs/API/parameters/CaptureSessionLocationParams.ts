import type {DrinkingSessionId, DrinksTimestamp} from '@src/types/onyx';
import type {DrinkLocation} from '@src/types/onyx/SessionLocations';

type CaptureSessionLocationParams = {
  sessionId: DrinkingSessionId;
  timestamp: DrinksTimestamp;
  location: DrinkLocation;
};

export default CaptureSessionLocationParams;
