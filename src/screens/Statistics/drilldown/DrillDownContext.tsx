import {createContext, useCallback, useContext, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import type {BucketDescriptor} from './types';

type DrillDownState = {
  activeBucket: BucketDescriptor | null;
};

type DrillDownActions = {
  openDrillDown: (bucket: BucketDescriptor) => void;
  closeDrillDown: () => void;
};

const DrillDownStateContext = createContext<DrillDownState | null>(null);
const DrillDownActionsContext = createContext<DrillDownActions | null>(null);

type DrillDownProviderProps = {
  children: ReactNode;
};

function DrillDownProvider({children}: DrillDownProviderProps) {
  const [activeBucket, setActiveBucket] = useState<BucketDescriptor | null>(
    null,
  );

  const openDrillDown = useCallback((bucket: BucketDescriptor) => {
    setActiveBucket(bucket);
  }, []);

  const closeDrillDown = useCallback(() => {
    setActiveBucket(null);
  }, []);

  const state = useMemo<DrillDownState>(() => ({activeBucket}), [activeBucket]);

  const actions = useMemo<DrillDownActions>(
    () => ({openDrillDown, closeDrillDown}),
    [openDrillDown, closeDrillDown],
  );

  return (
    <DrillDownActionsContext.Provider value={actions}>
      <DrillDownStateContext.Provider value={state}>
        {children}
      </DrillDownStateContext.Provider>
    </DrillDownActionsContext.Provider>
  );
}

type UseStatsDrillDownResult = DrillDownState & DrillDownActions;

function useStatsDrillDown(): UseStatsDrillDownResult {
  const state = useContext(DrillDownStateContext);
  const actions = useContext(DrillDownActionsContext);
  if (!state || !actions) {
    throw new Error(
      'useStatsDrillDown must be used inside a <DrillDownProvider>',
    );
  }
  return useMemo(() => ({...state, ...actions}), [state, actions]);
}

export default DrillDownProvider;
export {useStatsDrillDown};
export type {DrillDownActions, DrillDownProviderProps, DrillDownState};
