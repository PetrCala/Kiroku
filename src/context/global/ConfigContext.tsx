// ConfigContext.tsx
import type {ReactNode} from 'react';
import React, {createContext, useContext, useMemo} from 'react';
import {useOnyx} from 'react-native-onyx';
import type {Config} from '@src/types/onyx';
import ONYXKEYS from '@src/ONYXKEYS';

type ConfigContextType = {
  config?: Config;
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

const useConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

type ConfigProviderProps = {
  children: ReactNode;
};

function ConfigProvider({children}: ConfigProviderProps) {
  // Global app config is hydrated from `app/open` (kiroku-api) and kept live via
  // the public `config` Pusher broadcast (subscribed at boot in AuthScreens).
  const [config] = useOnyx(ONYXKEYS.CONFIG);

  const value = useMemo(
    () => ({
      config,
    }),
    [config],
  );
  return (
    <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
  );
}

export {ConfigContext, useConfig, ConfigProvider};
export type {ConfigContextType};
