// REMOVED: import crashlytics from '@react-native-firebase/crashlytics';
// Crashlytics temporarily disabled - module removed from dependencies
import React from 'react';
import Log from '@libs/Log';
import BaseErrorBoundary from './BaseErrorBoundary';
import type {BaseErrorBoundaryProps, LogError} from './types';

const logError: LogError = (errorMessage, error, errorInfo) => {
  // Log the error to the server
  Log.alert(`${errorMessage} - ${error.message}`, {errorInfo}, false);

  /* REMOVED: Crashlytics module no longer available
   * Fallback error logging while Crashlytics is disabled */
  if (__DEV__) {
    console.error('[ErrorBoundary] Error caught:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
  } else {
    // In production, at least log to console
    console.error('App error:', error.message);
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
