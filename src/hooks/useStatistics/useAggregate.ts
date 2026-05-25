import {aggregate} from '@libs/Statistics';
import type {
  Bucketer,
  DrinkEvent,
  EventFilter,
  Reducer,
} from '@libs/Statistics';

/**
 * Thin hook that runs `aggregate` over an event stream. Exists so chart code
 * has a single import surface and the React Compiler has a clean reactive
 * scope keyed on `(events, bucketer, reducer, filter)` identity. Callers
 * pass referentially-stable bucketers and reducers — the v2-C library
 * exports both as top-level constants, so this is free in practice.
 */
function useAggregate<TKey, TAgg>(
  events: DrinkEvent[],
  bucketer: Bucketer<TKey>,
  reducer: Reducer<TAgg>,
  filter?: EventFilter,
): Map<TKey, TAgg> {
  return aggregate(events, bucketer, reducer, filter);
}

export default useAggregate;
