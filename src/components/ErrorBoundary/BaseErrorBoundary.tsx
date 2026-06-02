import React from 'react';
import {ErrorBoundary} from 'react-error-boundary';
import BootSplash from '@libs/BootSplash';
import GenericErrorScreen from '@screens/ErrorScreen/GenericErrorScreen';
import type {BaseErrorBoundaryProps, LogError} from './types';

/**
 * This component captures an error in the child component tree and logs it to the server
 * It can be used to wrap the entire app as well as to wrap specific parts for more granularity
 * @see {@link https://reactjs.org/docs/error-boundaries.html#where-to-place-error-boundaries}
 */

function BaseErrorBoundary({
  logError = () => {},
  errorMessage,
  children,
}: BaseErrorBoundaryProps) {
  const catchError = (errorObject: Error, errorInfo: React.ErrorInfo) => {
    logError(errorMessage, errorObject, JSON.stringify(errorInfo));
    // We hide the splash screen since the error might have happened during app init
    BootSplash.hide();
  };

  return (
    <ErrorBoundary fallback={<GenericErrorScreen />} onError={catchError}>
      {children}
    </ErrorBoundary>
  );
}

BaseErrorBoundary.displayName = 'BaseErrorBoundary';
export type {LogError, BaseErrorBoundaryProps};
export default BaseErrorBoundary;
