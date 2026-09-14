import * as DS from '@userActions/DrinkingSession';
import * as SessionLocations from '@userActions/SessionLocations';
import CONST from '@src/CONST';
import type {DrinkingSession, DrinkKey} from '@src/types/onyx';
import useCurrentUserPreferences from './useCurrentUserPreferences';

/**
 * Add drinks to a session the way the session screen does: through
 * `updateDrinks`, which writes the local buffer right away and (for a live
 * session) arms the debounced persist, then tags the drink with a location
 * when the user opted in. Shared by the session screen and the Home live card
 * so both log a drink identically, online or offline.
 */
function useAddDrinks(
  session: DrinkingSession | undefined,
): (drinkKey: DrinkKey, amount: number) => void {
  const preferences = useCurrentUserPreferences();

  return (drinkKey: DrinkKey, amount: number) => {
    const timestamp = DS.updateDrinks(
      session?.id,
      drinkKey,
      amount,
      CONST.DRINKS.ACTIONS.ADD,
      preferences?.drinks_to_units,
    );
    if (
      timestamp !== undefined &&
      session?.ongoing === true &&
      session.id &&
      preferences?.track_location_during_sessions === true
    ) {
      // Fire-and-forget: capture must never block the drink-add UX.
      // captureForTimestamp swallows its own errors internally; the .catch
      // is a belt-and-suspenders no-op to satisfy no-floating-promises.
      SessionLocations.captureForTimestamp(session.id, timestamp).catch(
        () => {},
      );
    }
  };
}

export default useAddDrinks;
