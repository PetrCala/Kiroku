import React, {useState} from 'react';
import {ErrorBoundary} from 'react-error-boundary';
import BootSplash from '@libs/BootSplash';
// import GenericErrorScreen from '@screens/ErrorScreen/GenericErrorScreen';
// import UpdateRequiredView from '@pages/ErrorPage/UpdateRequiredView';
import ForceUpdateModal from '@components/Modals/ForceUpdateModal';
import CONST from '@src/CONST';
import type {BaseErrorBoundaryProps, LogError} from './types';
import NotFoundScreen from '@screens/ErrorScreen/NotFoundScreen';

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
  const [errorContent, setErrorContent] = useState('');
  const catchError = (errorObject: Error, errorInfo: React.ErrorInfo) => {
    logError(errorMessage, errorObject, JSON.stringify(errorInfo));
    // We hide the splash screen since the error might happened during app init
    BootSplash.hide();
    setErrorContent(errorObject.message);
  };
  const updateRequired = errorContent === CONST.ERROR.UPDATE_REQUIRED;

  return (
    <ErrorBoundary
      // TODO check that these error screens are correct
      //   fallback={updateRequired ? <UpdateRequiredView /> : <GenericErrorPage />}
      fallback={updateRequired ? <ForceUpdateModal /> : <NotFoundScreen />}
      onError={catchError}>
      {children}
    </ErrorBoundary>
  );
}

BaseErrorBoundary.displayName = 'BaseErrorBoundary';
export type {LogError, BaseErrorBoundaryProps};
export default BaseErrorBoundary;
