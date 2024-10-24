import React from 'react';
import {PortalProvider} from '@gorhom/portal';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import type {Route} from './ROUTES';
import InitialUrlContext from '@libs/InitialUrlContext';
import ColorSchemeWrapper from './components/ColorSchemeWrapper';
import Kiroku from './Kiroku';
import ActiveElementRoleProvider from './components/ActiveElementRoleProvider';
import ComposeProviders from '@components/ComposeProviders';
import ErrorBoundary from './components/ErrorBoundary';
import {LocaleContextProvider} from './components/LocaleContextProvider';
import OnyxProvider from './components/OnyxProvider';
import {FirebaseProvider} from '@context/global/FirebaseContext';
import {UserConnectionProvider} from '@context/global/UserConnectionContext';
import {ConfigProvider} from '@context/global/ConfigContext';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {WindowDimensionsProvider} from '@components/withWindowDimensions';
import {KeyboardStateProvider} from '@components/withKeyboardState';
import {EnvironmentProvider} from './components/withEnvironment';
import ThemeProvider from './components/ThemeProvider';
import ThemeStylesProvider from './components/ThemeStylesProvider';
import SafeArea from '@components/SafeArea';
import CustomStatusBarAndBackground from './components/CustomStatusBarAndBackground';
import CustomStatusBarAndBackgroundContextProvider from './components/CustomStatusBarAndBackground/CustomStatusBarAndBackgroundContextProvider';
// import OnyxUpdateManager from './libs/actions/OnyxUpdateManager';
// import {LogBox} from 'react-native';

type KirokuProps = {
  /** true if there is an authToken */
  url?: Route;
};

// LogBox.ignoreLogs([
// Basically it means that if the app goes in the background and back to foreground on Android,
// the timer is lost. Currently we are using a 30 minutes interval to refresh personal details.
// More details here: https://git.io/JJYeb
//   'Setting a timer for a long period of time',
// ]);

const fill = {flex: 1};

const App = ({url}: KirokuProps): React.JSX.Element => {
  // OnyxUpdateManager(); // Fix the API first before enabling this
  return (
    <InitialUrlContext.Provider value={url}>
      <GestureHandlerRootView style={fill}>
        <ComposeProviders
          components={[
            OnyxProvider,
            ThemeProvider,
            ThemeStylesProvider,
            FirebaseProvider,
            UserConnectionProvider,
            ConfigProvider,
            SafeAreaProvider,
            PortalProvider,
            SafeArea,
            LocaleContextProvider,
            WindowDimensionsProvider,
            KeyboardStateProvider,
            EnvironmentProvider,
            CustomStatusBarAndBackgroundContextProvider,
            ActiveElementRoleProvider,
          ]}>
          <CustomStatusBarAndBackground />
          <ErrorBoundary errorMessage="Kiroku crash caught by error boundary">
            <ColorSchemeWrapper>
              <Kiroku />
            </ColorSchemeWrapper>
          </ErrorBoundary>
        </ComposeProviders>
      </GestureHandlerRootView>
    </InitialUrlContext.Provider>
  );
};

App.displayName = 'App';

export default App;
