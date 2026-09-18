import {useMemo} from 'react';
import useCurrentUserDrinkingSessions from '@hooks/useCurrentUserDrinkingSessions';
import {buildDrinkProfile} from '@libs/DrinkRanking';
import type {DrinkProfile} from '@libs/DrinkRanking/types';

/**
 * The signed-in user's drink profile, built from their recent finished
 * sessions (`buildDrinkProfile`). It is what puts drink types in the user's own
 * order rather than a fixed one, so every surface that lists drink types can
 * agree on what comes first.
 *
 * Building it walks the whole session list, so a screen that renders many
 * session tiles reads it ONCE here and passes it down, rather than having each
 * tile build its own.
 */
function useDrinkProfile(): DrinkProfile {
  const drinkingSessions = useCurrentUserDrinkingSessions();

  return useMemo(() => buildDrinkProfile(drinkingSessions), [drinkingSessions]);
}

export default useDrinkProfile;
