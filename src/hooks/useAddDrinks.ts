import * as DS from '@userActions/DrinkingSession';
import * as SessionLocations from '@userActions/SessionLocations';
import type {AddEntryOverrides} from '@libs/DrinkingSessionUtils';
import {isSchemaV2Session} from '@libs/SessionEntries';
import CONST from '@src/CONST';
import type {DrinkingSession, DrinkKey} from '@src/types/onyx';
import type {SessionEntryId} from '@src/types/onyx/SessionEntries';
import useCurrentUserPreferences from './useCurrentUserPreferences';

/** What one add produced, when it produced anything. */
type AddedDrink = {
  /** The entry's id. Absent on a legacy session, which has no entry ids. */
  entryId?: SessionEntryId;

  /** The time the drink was logged at */
  ts: number;
};

/** Log a drink, optionally naming its serving and when it happened. */
type AddDrinks = (
  drinkKey: DrinkKey,
  amount: number,
  overrides?: AddEntryOverrides,
) => AddedDrink | undefined;

/**
 * Add drinks to a session the way the session screen does, then tag the drink
 * with a location when the user opted in. Shared by the session screen, the
 * capture UI's add sheet and the Home live card, so every one of them logs a
 * drink identically, online or offline.
 *
 * A schema 2 session goes through `addSessionEntry`, which returns the new
 * entry's id: that is what lets the caller offer "Undo" on exactly the drink
 * just added, and what lets the add name a serving or a time of its own
 * (a retro-add). A legacy session has no entry ids, so it keeps going through
 * `updateDrinks` and reports only the timestamp.
 */
function useAddDrinks(session: DrinkingSession | undefined): AddDrinks {
  const preferences = useCurrentUserPreferences();

  return (drinkKey, amount, overrides) => {
    const added = isSchemaV2Session(session)
      ? DS.addSessionEntry(session?.id, {
          drinkKey,
          amount,
          drinksToUnits: preferences?.drinks_to_units,
          ...overrides,
        })
      : withoutEntryId(
          DS.updateDrinks(
            session?.id,
            drinkKey,
            amount,
            CONST.DRINKS.ACTIONS.ADD,
            preferences?.drinks_to_units,
          ),
        );

    if (
      added !== undefined &&
      session?.ongoing === true &&
      session.id &&
      preferences?.track_location_during_sessions === true
    ) {
      // Fire-and-forget: capture must never block the drink-add UX.
      // captureForTimestamp swallows its own errors internally; the .catch
      // is a belt-and-suspenders no-op to satisfy no-floating-promises.
      SessionLocations.captureForTimestamp(session.id, added.ts).catch(
        () => {},
      );
    }
    return added;
  };
}

/** A legacy add reports only the timestamp it wrote the drink under. */
function withoutEntryId(ts: number | undefined): AddedDrink | undefined {
  return ts === undefined ? undefined : {ts};
}

export default useAddDrinks;
export type {AddDrinks, AddedDrink};
