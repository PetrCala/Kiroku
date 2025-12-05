// REMOVED: import crashlytics from '@react-native-firebase/crashlytics';
// Crashlytics temporarily disabled - module removed from dependencies
import React from 'react';
import Log from '@libs/Log';
import BaseErrorBoundary from './BaseErrorBoundary';
import type {BaseErrorBoundaryProps, LogError} from './types';

const logError: LogError = (errorMessage, error, errorInfo) => {
  // Detect Firebase/AsyncStorage initialization errors
  const errorString = error.message.toLowerCase();
  const isFirebaseError =
    errorString.includes('firebase') ||
    errorString.includes('asyncstorage') ||
    errorString.includes('native module') ||
    errorString.includes('rct');

  if (isFirebaseError) {
    // Firebase/native module initialization error detected
    Log.alert(
      `[Firebase Init Error] ${errorMessage}`,
      {
        error: error.message,
        hint: 'This may be caused by accessing AsyncStorage before React Native bridge is ready',
      },
      false,
    );
  } else {
    // Regular error logging
    Log.alert(`${errorMessage} - ${error.message}`, {errorInfo}, false);
  }

  /* REMOVED: Crashlytics module no longer available
   * Fallback error logging while Crashlytics is disabled */
  if (__DEV__) {
    Log.alert(`[ErrorBoundary] Error caught: ${error.message}`);
    Log.alert(`[ErrorBoundary] Error info: ${errorInfo}`);
  } else {
    // In production, log error details for debugging
    Log.alert(`App error: ${error.message}`);
    if (isFirebaseError) {
      Log.alert(
        'CRITICAL: Firebase initialization error in production - check AsyncStorage timing',
      );
    }
  }
};

function ErrorBoundary({
  errorMessage,
  children,
}: Omit<BaseErrorBoundaryProps, 'logError'>) {
  return (
    <BaseErrorBoundary errorMessage={errorMessage} logError={logError}>
      {children}
    </BaseErrorBoundary>
  );
}

ErrorBoundary.displayName = 'ErrorBoundary';

export default ErrorBoundary;
