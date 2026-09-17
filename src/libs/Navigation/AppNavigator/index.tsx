import React, {lazy, Suspense, useContext, useEffect} from 'react';
import {NativeModules} from 'react-native';
import InitialUrlContext from '@libs/InitialUrlContext';
import Navigation from '@navigation/Navigation';
import lazyRetry from '@src/utils/lazyRetry';

// Start the authenticated chunk's fetch at module evaluation, i.e. at app
// boot, so it downloads and parses in parallel with Firebase Auth resolving
// rather than starting only once `authenticated` flips. `lazy` is handed the
// same promise, so lazyRetry's refresh-once recovery still runs exactly once.
const authScreensImport = lazyRetry(() => import('./AuthScreens'));
// The public stack may never render AuthScreens, leaving the preload's
// rejection unobserved. Attach a no-op handler so a failed warm-up is not
// reported as an unhandled rejection; React observes the same promise again
// and surfaces the error where it can actually be handled.
authScreensImport.catch(() => {});
const AuthScreens = lazy(() => authScreensImport);
const PublicScreens = lazy(() => lazyRetry(() => import('./PublicScreens')));

type AppNavigatorProps = {
  /** If we have an authToken this is true */
  authenticated: boolean;
};

function AppNavigator({authenticated}: AppNavigatorProps) {
  const initUrl = useContext(InitialUrlContext);

  useEffect(() => {
    if (!NativeModules.HybridAppModule || !initUrl) {
      return;
    }

    Navigation.isNavigationReady().then(() => {
      Navigation.navigate(initUrl);
    });
  }, [initUrl]);

  if (authenticated) {
    // These are the protected screens and only accessible when an authToken is present
    return (
      <Suspense fallback={null}>
        <AuthScreens />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <PublicScreens />
    </Suspense>
  );
}

AppNavigator.displayName = 'AppNavigator';
export default AppNavigator;
