import {useEffect, useState} from 'react';
import {InteractionManager} from 'react-native';
import {aggregate} from '@libs/Statistics';
import type {
  Bucketer,
  DrinkEvent,
  EventFilter,
  Reducer,
} from '@libs/Statistics';

const EMPTY_MAP: ReadonlyMap<unknown, unknown> = new Map();

function emptyMap<TKey, TAgg>(): Map<TKey, TAgg> {
  return EMPTY_MAP as Map<TKey, TAgg>;
}

/**
 * Thin hook that runs `aggregate` over an event stream. Exists so chart code
 * has a single import surface and the React Compiler has a clean reactive
 * scope keyed on `(events, bucketer, reducer, filter)` identity. Callers
 * pass referentially-stable bucketers and reducers — the v2-C library
 * exports both as top-level constants, so this is free in practice.
 *
 * The actual `aggregate` call is deferred past the navigation transition
 * with `InteractionManager.runAfterInteractions`. The first render returns
 * an empty map (cheap) so the host tab paints skeletons; a later frame
 * computes the real aggregate and the tab re-renders with data. Callers
 * read `isLoading` from `useDrinkEvents` upstream — they do not need to
 * track loading per-aggregate.
 */
function useAggregate<TKey, TAgg>(
  events: DrinkEvent[],
  bucketer: Bucketer<TKey>,
  reducer: Reducer<TAgg>,
  filter?: EventFilter,
): Map<TKey, TAgg> {
  const [result, setResult] = useState<Map<TKey, TAgg>>(emptyMap);

  useEffect(() => {
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) {
        return;
      }
      setResult(
        events.length === 0
          ? emptyMap<TKey, TAgg>()
          : aggregate(events, bucketer, reducer, filter),
      );
    });
    return () => {
      cancelled = true;
      handle.cancel?.();
    };
  }, [events, bucketer, reducer, filter]);

  return result;
}

export default useAggregate;
