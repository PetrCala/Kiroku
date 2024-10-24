import mapValues from 'lodash/mapValues';
import type {OnyxEntry} from 'react-native-onyx';
import CONST from '@src/CONST';
import type {
  TranslationFlatObject,
  TranslationPaths,
} from '@src/languages/types';
import type {ErrorFields, Errors} from '@src/types/onyx/OnyxCommon';
import type Response from '@src/types/onyx/Response';
import DateUtils from './DateUtils';
import * as Localize from './Localize';
import {Alert} from 'react-native';

/**
 * Parses the error object and returns the appropriate error message.
 *
 * @param error - The error object to be translated.
 * @returns
 */
function getErrorMessage(error: any): string {
  const err = error.message;
  switch (true) {
    case err.includes('storage/object-not-found'):
      return 'Object not found';
    case err.includes('storage/unauthorized'):
      return 'Unauthorized access';
    case err.includes('auth/missing-email'):
      return 'Missing email';
    case err.includes('auth/invalid-email'):
      return 'Invalid email';
    case err.includes('verify the new email'):
      return 'Please verify your email first before changing it.';
    case err.includes('auth/missing-password'):
      return 'Missing password';
    case err.includes('auth/invalid-credential'):
      return 'Invalid credentials';
    case err.includes('auth/weak-password'):
      return 'Your password is too weak - password should be at least 6 characters';
    case err.includes('auth/email-already-in-use'):
      return 'This email is already in use';
    case err.includes('auth/user-not-found'):
      return 'User not found';
    case err.includes('auth/wrong-password'):
      return 'Incorrect password';
    case err.includes('auth/network-request-failed'):
      return 'You are offline';
    case err.includes('auth/requires-recent-login'):
      return 'Please login again';
    case err.includes('auth/api-key-not-valid'):
      return 'The app is not configured correctly. Please contact the developer.';
    case err.includes('auth/too-many-requests'):
      return 'Too many requests. Please wait a moment and try again later.';
    case err.includes('PERMISSION_DENIED: Permission denied'):
      return 'Permission denied. Please contact the administrator for assistance.';
    default:
      return err;
  }
}

function raiseAlert(
  error: any,
  heading: string = '',
  message: string = '',
): void {
  const payload = getErrorMessage(error);
  Alert.alert(heading ?? 'Unknown error', `${message || ''}` + payload);
}

/**
 * Creates an error object with a timestamp (in microseconds) as the key and the translated error message as the value.
 * @param error - The translation key for the error message.
 */
function getMicroSecondOnyxErrorWithTranslationKey(
  error: TranslationPaths,
  errorKey?: number,
): Errors {
  return {
    [errorKey ?? DateUtils.getMicroseconds()]: Localize.translateLocal(error),
  };
}

/**
 * Creates an error object with a timestamp (in microseconds) as the key and the error message as the value.
 * @param error - The error message.
 */
function getMicroSecondOnyxErrorWithMessage(
  error: string,
  errorKey?: number,
): Errors {
  return {[errorKey ?? DateUtils.getMicroseconds()]: error};
}

/**
 * Method used to get an error object with microsecond as the key and an object as the value.
 * @param error - error key or message to be saved
 */
function getMicroSecondOnyxErrorObject(
  error: Errors,
  errorKey?: number,
): ErrorFields {
  return {[errorKey ?? DateUtils.getMicroseconds()]: error};
}

// We can assume that if error is a string, it has already been translated because it is server error
function getErrorMessageWithTranslationData(error: string | null): string {
  return error ?? '';
}

type OnyxDataWithErrors = {
  errors?: Errors | null;
};

function getLatestErrorMessage<TOnyxData extends OnyxDataWithErrors>(
  onyxData: OnyxEntry<TOnyxData> | null,
): string {
  const errors = onyxData?.errors ?? {};

  if (Object.keys(errors).length === 0) {
    return '';
  }

  const key = Object.keys(errors).sort().reverse()[0];
  return getErrorMessageWithTranslationData(errors[key] ?? '');
}

function getLatestErrorMessageField<TOnyxData extends OnyxDataWithErrors>(
  onyxData: OnyxEntry<TOnyxData>,
): Errors {
  const errors = onyxData?.errors ?? {};

  if (Object.keys(errors).length === 0) {
    return {};
  }

  const key = Object.keys(errors).sort().reverse()[0];

  return {key: errors[key]};
}

type OnyxDataWithErrorFields = {
  errorFields?: ErrorFields;
};

function getLatestErrorField<TOnyxData extends OnyxDataWithErrorFields>(
  onyxData: OnyxEntry<TOnyxData>,
  fieldName: string,
): Errors {
  const errorsForField = onyxData?.errorFields?.[fieldName] ?? {};

  if (Object.keys(errorsForField).length === 0) {
    return {};
  }

  const key = Object.keys(errorsForField).sort().reverse()[0];
  return {[key]: getErrorMessageWithTranslationData(errorsForField[key])};
}

function getEarliestErrorField<TOnyxData extends OnyxDataWithErrorFields>(
  onyxData: OnyxEntry<TOnyxData>,
  fieldName: string,
): Errors {
  const errorsForField = onyxData?.errorFields?.[fieldName] ?? {};

  if (Object.keys(errorsForField).length === 0) {
    return {};
  }

  const key = Object.keys(errorsForField).sort()[0];
  return {[key]: getErrorMessageWithTranslationData(errorsForField[key])};
}

/**
 * Method used to get the latest error field for any field
 */
function getLatestErrorFieldForAnyField<
  TOnyxData extends OnyxDataWithErrorFields,
>(onyxData: OnyxEntry<TOnyxData>): Errors {
  const errorFields = onyxData?.errorFields ?? {};

  if (Object.keys(errorFields).length === 0) {
    return {};
  }

  const fieldNames = Object.keys(errorFields);
  const latestErrorFields = fieldNames.map(fieldName =>
    getLatestErrorField(onyxData, fieldName),
  );
  return latestErrorFields.reduce(
    (acc, error) => Object.assign(acc, error),
    {},
  );
}

/**
 * Method used to attach already translated message
 * @param errors - An object containing current errors in the form
 * @returns Errors in the form of {timestamp: message}
 */
function getErrorsWithTranslationData(errors: Errors): Errors {
  if (!errors) {
    return {};
  }

  if (typeof errors === 'string') {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    return {'0': getErrorMessageWithTranslationData(errors)};
  }

  return mapValues(errors, getErrorMessageWithTranslationData);
}

/**
 * Method used to generate error message for given inputID
 * @param errors - An object containing current errors in the form
 * @param message - Message to assign to the inputID errors
 */
function addErrorMessage(
  errors: Errors,
  inputID?: string | null,
  message?: string | null,
) {
  if (!message || !inputID) {
    return;
  }

  const errorList = errors;
  const error = errorList[inputID];

  if (!error) {
    errorList[inputID] = message;
  } else if (typeof error === 'string') {
    errorList[inputID] = `${error}\n${message}`;
  }
}

export {
  getErrorMessage,
  addErrorMessage,
  getEarliestErrorField,
  getErrorMessageWithTranslationData,
  getErrorsWithTranslationData,
  getLatestErrorField,
  getLatestErrorFieldForAnyField,
  getLatestErrorMessage,
  getLatestErrorMessageField,
  getMicroSecondOnyxErrorWithTranslationKey,
  getMicroSecondOnyxErrorWithMessage,
  getMicroSecondOnyxErrorObject,
  raiseAlert,
};

export type {OnyxDataWithErrors};
