import {useContext, useMemo} from 'react';
import {
  StatsActionsContext,
  StatsStateContext,
} from '@components/StatsContextProvider';
import type {StatsContextValue} from '@components/StatsContextProvider';

export default function useStatsContext(): StatsContextValue {
  const state = useContext(StatsStateContext);
  const actions = useContext(StatsActionsContext);
  if (!state || !actions) {
    throw new Error(
      'useStatsContext must be used inside a <StatsContextProvider>',
    );
  }
  return useMemo(
    () => ({...state, ...actions}),
    [state, actions],
  );
}
