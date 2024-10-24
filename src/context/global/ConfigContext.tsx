import type {ReactNode} from 'react';
import {useEffect, useReducer} from 'react';
import {useUserConnection} from './UserConnectionContext';
import UserOffline from '@components/UserOffline';
import {listenForDataChanges} from '@database/baseFunctions';
import {useFirebase} from './FirebaseContext';
import {validateAppVersion} from '@libs/Validation';
import type {Config} from '@src/types/onyx';
import ForceUpdateModal from '@components/Modals/ForceUpdateModal';
import DBPATHS from '@database/DBPATHS';
import UnderMaintenanceModal from '@components/Modals/UnderMaintenanceModal';
import {isUnderMaintenance} from '@libs/Maintenance';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';

const initialState = {
  isLoading: true,
  versionValid: false,
  config: null,
  underMaintenance: false,
};

const reducer = (state: any, action: any) => {
  switch (action.type) {
    case 'SET_IS_LOADING':
      return {...state, isLoading: action.payload};
    case 'SET_VERSION_VALID':
      return {...state, versionValid: action.payload};
    case 'SET_CONFIG':
      return {...state, config: action.payload};
    case 'SET_UNDER_MAINTENANCE':
      return {...state, underMaintenance: action.payload};
    default:
      return state;
  }
};

type ConfigProviderProps = {
  children: ReactNode;
};

export const ConfigProvider: React.FC<ConfigProviderProps> = ({children}) => {
  const {isOnline} = useUserConnection();
  const {db} = useFirebase();
  const [state, dispatch] = useReducer(reducer, initialState);

  const updateLocalHooks = (newConfigData: Config | null) => {
    const underMaintenance: boolean = isUnderMaintenance(
      newConfigData?.maintenance,
    );
    const minSupportedVersion =
      newConfigData?.app_settings.min_supported_version;
    const versionValidationResult = validateAppVersion(minSupportedVersion);

    dispatch({type: 'SET_UNDER_MAINTENANCE', payload: underMaintenance});
    dispatch({
      type: 'SET_VERSION_VALID',
      payload: versionValidationResult.success,
    });
  };

  useEffect(() => {
    const configPath = DBPATHS.CONFIG;
    const stopListening = listenForDataChanges(
      db,
      configPath,
      (data: Config) => {
        dispatch({type: 'SET_IS_LOADING', payload: true});
        dispatch({type: 'SET_CONFIG', payload: data});
        updateLocalHooks(data);
        dispatch({type: 'SET_IS_LOADING', payload: false});
      },
    );

    return () => stopListening();
  }, []);

  // Modals to render before navigation is initialized
  if (!isOnline) {
    return <UserOffline />;
  }
  if (state.isLoading) {
    return <FullScreenLoadingIndicator />;
  }
  if (state.underMaintenance) {
    return <UnderMaintenanceModal config={state.config} />;
  }
  if (!state.versionValid) {
    return <ForceUpdateModal />;
  }

  return <>{children}</>;
};
