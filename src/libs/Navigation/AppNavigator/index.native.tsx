import React, {memo, useContext, useEffect} from 'react';
import {NativeModules} from 'react-native';
import {InitialURLContext} from '@components/InitialURLContextProvider';
import Navigation from '@libs/Navigation/Navigation';
import type ReactComponentModule from '@src/types/utils/ReactComponentModule';

type AppNavigatorProps = {
  /** If we have an authToken this is true */
  authenticated: boolean;
};

function AppNavigator({authenticated}: AppNavigatorProps) {
  const initUrl = useContext(InitialURLContext);

  useEffect(() => {
    if (
      !NativeModules.HybridAppModule ||
      !initUrl
      //   !initUrl.includes(ROUTES.TRANSITION_BETWEEN_APPS)
    ) {
      return;
    }

    Navigation.isNavigationReady().then(() => {
      Navigation.navigate(initUrl);
    });
  }, [initUrl]);

  if (authenticated) {
    let AuthScreens;
    try {
      AuthScreens = require<ReactComponentModule>('./AuthScreens').default;
    } catch (error) {
      console.error('[AppNavigator] Failed to load AuthScreens:', error);
      throw new Error(`AuthScreens module failed to load: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!AuthScreens) {
      throw new Error('AuthScreens module loaded but default export is undefined');
    }

    // These are the protected screens and only accessible when an authToken is present
    return <AuthScreens />;
  }

  let PublicScreens;
  try {
    PublicScreens = require<ReactComponentModule>('./PublicScreens').default;
  } catch (error) {
    console.error('[AppNavigator] Failed to load PublicScreens:', error);
    throw new Error(`PublicScreens module failed to load: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!PublicScreens) {
    throw new Error('PublicScreens module loaded but default export is undefined');
  }

  return <PublicScreens />;
}

AppNavigator.displayName = 'AppNavigator';

export default memo(AppNavigator);
