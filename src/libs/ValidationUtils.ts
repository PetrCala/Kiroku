import {
  addYears,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isValid,
  isWithinInterval,
  parse,
  parseISO,
  startOfDay,
  subYears,
} from 'date-fns';
// eslint-disable-next-line you-dont-need-lodash-underscore/is-date
import isDate from 'lodash/isDate';
import isEmpty from 'lodash/isEmpty';
import isObject from 'lodash/isObject';
import type {
  FormInputErrors,
  FormOnyxKeys,
  FormOnyxValues,
  FormValue,
} from '@components/Form/types';
import CONST from '@src/CONST';
import type {OnyxFormKey} from '@src/ONYXKEYS';
import type {TranslationPaths} from '@src/languages/types';
import DateUtils from './DateUtils';
import type {MaybePhraseKey} from './Localize';
import * as Localize from './Localize';
import ProfanityFilter from './ProfanityFilter';
import StringUtils from './StringUtils';
import {URL_REGEX_WITH_REQUIRED_PROTOCOL} from './common/Url';

/**
 * Implements the Luhn Algorithm, a checksum formula used to validate credit card
 * numbers.
 */
function validateCardNumber(value: string): boolean {
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    let intVal = parseInt(value.substr(i, 1), 10);
    if (i % 2 === 0) {
      intVal *= 2;
      if (intVal > 9) {
        intVal = 1 + (intVal % 10);
      }
    }
    sum += intVal;
  }
  return sum % 10 === 0;
}

function isValidEmail(email: string): boolean {
  return CONST.REGEX.EMAIL.test(email);
}

/**
 * Validate date fields
 */
function isValidDate(date: string | Date): boolean {
  if (!date) {
    return false;
  }

  const pastDate = subYears(new Date(), 1000);
  const futureDate = addYears(new Date(), 1000);
  const testDate = new Date(date);
  return (
    isValid(testDate) &&
    isAfter(testDate, pastDate) &&
    isBefore(testDate, futureDate)
  );
}

/**
 * Validate that a password is complex enough.
 */
function isComplexPassword(password: string): boolean {
  return CONST.REGEX.COMPLEX_PASSWORD.test(password);
}

/**
 * Validate that date entered isn't a future date.
 */
function isValidPastDate(date: string | Date): boolean {
  if (!date) {
    return false;
  }

  const pastDate = subYears(new Date(), 1000);
  const currentDate = new Date();
  const testDate = startOfDay(new Date(date));
  return (
    isValid(testDate) &&
    isAfter(testDate, pastDate) &&
    isBefore(testDate, currentDate)
  );
}

/**
 * Used to validate a value that is "required".
 * @param value - field value
 */
function isRequiredFulfilled(
  value?: FormValue | number[] | string[] | Record<string, string>, // Should be this
): boolean {
  if (!value) {
    return false;
  }
  if (typeof value === 'string') {
    return !StringUtils.isEmptyString(value);
  }

  if (isDate(value)) {
    return isValidDate(value);
  }
  if (Array.isArray(value) || isObject(value)) {
    return !isEmpty(value);
  }
  return !!value;
}

/**
 * Used to add requiredField error to the fields passed.
 * @param values - all form values
 * @param requiredFields - required fields for particular form
 */
function getFieldRequiredErrors<TFormID extends OnyxFormKey>(
  values: FormOnyxValues<TFormID>,
  requiredFields: Array<FormOnyxKeys<TFormID>>,
): FormInputErrors<TFormID> {
  const errors: FormInputErrors<TFormID> = {};

  requiredFields.forEach(fieldKey => {
    if (isRequiredFulfilled(values[fieldKey] as FormValue)) {
      return;
    }

    errors[fieldKey] = Localize.translateLocal('common.error.fieldRequired');
  });

  return errors;
}

/**
 * Validates that this is a valid security code
 * in the XXX or XXXX format.
 */
function isValidSecurityCode(string: string): boolean {
  return CONST.REGEX.CARD_SECURITY_CODE.test(string);
}

/**
 * Validates a debit card number (15 or 16 digits).
 */
function isValidDebitCard(string: string): boolean {
  if (!CONST.REGEX.CARD_NUMBER.test(string)) {
    return false;
  }

  return validateCardNumber(string);
}

/**
 * Validate that a date meets the minimum age requirement.
 */
function meetsMinimumAgeRequirement(date: string): boolean {
  const testDate = new Date(date);
  const minDate = subYears(new Date(), CONST.DATE_BIRTH.MIN_AGE);
  return (
    isValid(testDate) &&
    (isSameDay(testDate, minDate) || isBefore(testDate, minDate))
  );
}

/**
 * Validate that a date meets the maximum age requirement.
 */
function meetsMaximumAgeRequirement(date: string): boolean {
  const testDate = new Date(date);
  const maxDate = subYears(new Date(), CONST.DATE_BIRTH.MAX_AGE);
  return (
    isValid(testDate) &&
    (isSameDay(testDate, maxDate) || isAfter(testDate, maxDate))
  );
}

/**
 * Validate that given date is in a specified range of years before now.
 */
function getAgeRequirementError(
  date: string,
  minimumAge: number,
  maximumAge: number,
): MaybePhraseKey {
  const currentDate = startOfDay(new Date());
  const testDate = parse(date, CONST.DATE.FNS_FORMAT_STRING, currentDate);

  if (!isValid(testDate)) {
    return 'common.error.dateInvalid';
  }

  const maximalDate = subYears(currentDate, minimumAge);
  const minimalDate = subYears(currentDate, maximumAge);

  if (isWithinInterval(testDate, {start: minimalDate, end: maximalDate})) {
    return '';
  }

  if (isSameDay(testDate, maximalDate) || isAfter(testDate, maximalDate)) {
    return [
      'UserPrivateData.error.dateShouldBeBefore',
      {dateString: format(maximalDate, CONST.DATE.FNS_FORMAT_STRING)},
    ];
  }

  return [
    'UserPrivateData.error.dateShouldBeAfter',
    {dateString: format(minimalDate, CONST.DATE.FNS_FORMAT_STRING)},
  ];
}

/**
 * Checks that the provided name doesn't contain any commas or semicolons, and
 * doesn't contain objectionable language. The profanity check is a soft,
 * client-side guard for immediate inline feedback; the server is authoritative.
 */
function isValidDisplayName(name: string): boolean {
  return (
    !name.includes(',') &&
    !name.includes(';') &&
    !ProfanityFilter.containsProfanity(name)
  );
}

/**
 * Validate that given date is not in the past.
 */
function getDatePassedError(inputDate: string): string {
  const currentDate = new Date();
  const parsedDate = new Date(`${inputDate}T00:00:00`); // set time to 00:00:00 for accurate comparison

  // If input date is not valid, return an error
  if (!isValid(parsedDate)) {
    return 'common.error.dateInvalid';
  }

  // Clear time for currentDate so comparison is based solely on the date
  currentDate.setHours(0, 0, 0, 0);

  if (parsedDate < currentDate) {
    return 'common.error.dateInvalid';
  }

  return '';
}

/** Check an email for validity and return a key for the error message
 *
 * @param email - email to check
 * @param currentEmail - current email to compare against
 *
 */
function validateEmail(
  email: string,
  currentEmail?: string | null,
): TranslationPaths | null {
  if (email.length === 0) {
    return 'emailForm.error.pleaseEnterEmail';
  }
  if (!isValidEmail(email)) {
    return 'emailForm.error.invalidEmail';
  }
  if (currentEmail && email === currentEmail) {
    return 'emailForm.error.sameEmail';
  }
  if (email.length > CONST.EMAIL_MAX_LENGTH) {
    return 'emailForm.error.emailTooLong';
  }
  return null;
}

function validatePassword(
  password: string,
  currentPassword?: string | null,
): TranslationPaths | null {
  if (password.length === 0) {
    return 'password.pleaseFillPassword';
  }
  if (!isComplexPassword(password)) {
    return 'password.requirements';
  }
  if (currentPassword && password === currentPassword) {
    return 'password.error.samePassword';
  }
  return null;
}

function validateUsername(
  username: string,
  currentUsername?: string | null,
): TranslationPaths | null {
  if (username.length === 0) {
    return 'username.error.usernameRequired';
  }
  // Check profanity before the generic character check so the dedicated
  // message wins over the broader "invalid character" one (isValidDisplayName
  // also rejects profanity, but only as a boolean without a tailored message).
  if (ProfanityFilter.containsProfanity(username)) {
    return 'personalDetails.error.containsProfanity';
  }
  if (!isValidDisplayName(username)) {
    return 'personalDetails.error.hasInvalidCharacter';
  }
  if (username.length > CONST.TITLE_CHARACTER_LIMIT) {
    return 'username.error.usernameTooLong';
  }
  if (doesContainReservedWord(username, CONST.DISPLAY_NAME.RESERVED_NAMES)) {
    return 'personalDetails.error.containsReservedWord';
  }
  if (currentUsername && username === currentUsername) {
    return 'username.error.sameUsername';
  }
  return null;
}

/**
 * Similar to backend, checks whether a website has a valid URL or not.
 * http/https/ftp URL scheme required.
 */
function isValidWebsite(url: string): boolean {
  const isLowerCase = url === url.toLowerCase();
  return (
    new RegExp(`^${URL_REGEX_WITH_REQUIRED_PROTOCOL}$`, 'i').test(url) &&
    isLowerCase
  );
}

function isValidSessionNote(note: string): boolean {
  return note.length <= CONST.SESSION_NAME_CHARACTER_LIMIT;
}

function isValidValidateCode(validateCode: string): boolean {
  return !!validateCode.match(CONST.VALIDATE_CODE_REGEX_STRING);
}

function isValidRecoveryCode(recoveryCode: string): boolean {
  return !!recoveryCode.match(CONST.RECOVERY_CODE_REGEX_STRING);
}

function isValidTwoFactorCode(code: string): boolean {
  return !!code.match(CONST.REGEX.CODE_2FA);
}

/**
 * Checks the given number is a valid US Routing Number
 * using ABA routingNumber checksum algorithm: http://www.brainjar.com/js/validation/
 */
function isValidRoutingNumber(routingNumber: string): boolean {
  let n = 0;
  for (let i = 0; i < routingNumber.length; i += 3) {
    n +=
      parseInt(routingNumber.charAt(i), 10) * 3 +
      parseInt(routingNumber.charAt(i + 1), 10) * 7 +
      parseInt(routingNumber.charAt(i + 2), 10);
  }

  // If the resulting sum is an even multiple of ten (but not zero),
  // the ABA routing number is valid.
  if (n !== 0 && n % 10 === 0) {
    return true;
  }
  return false;
}

// /**
//  * Checks that the provided legal name doesn't contain special characters
//  */
// function isValidLegalName(name: string): boolean {
//   const hasAccentedChars = Boolean(name.match(CONST.REGEX.ACCENT_LATIN_CHARS));
//   return CONST.REGEX.ALPHABETIC_AND_LATIN_CHARS.test(name) && !hasAccentedChars;
// }

/**
 * Checks that the provided name doesn't contain special characters or numbers
 */
function isValidPersonName(value: string) {
  return /^[^\d^!#$%*=<>;{}"]+$/.test(value);
}

/**
 * Checks if the provided string includes any of the provided reserved words
 */
function doesContainReservedWord(
  value: string,
  reservedWords: typeof CONST.DISPLAY_NAME.RESERVED_NAMES,
): boolean {
  const valueToCheck = value.trim().toLowerCase();
  return reservedWords.some(reservedWord =>
    valueToCheck.includes(reservedWord.toLowerCase()),
  );
}

// /**
//  * Checks if tax ID consists of 9 digits
//  */
// function isValidTaxID(taxID: string): boolean {
//   return CONST.REGEX.TAX_ID.test(taxID);
// }

/**
 * Checks if a string value is a number.
 */
function isNumeric(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return /^\d*$/.test(value);
}

type DateTimeValidationErrorKeys = {
  dateValidationErrorKey: string;
  timeValidationErrorKey: string;
};
/**
 * Validates that the date and time are at least one minute in the future.
 * data - A date and time string in 'YYYY-MM-DD HH:mm:ss.sssZ' format
 * returns an object containing the error messages for the date and time
 */
const validateDateTimeIsAtLeastOneMinuteInFuture = (
  data: string,
): DateTimeValidationErrorKeys => {
  if (!data) {
    return {
      dateValidationErrorKey: '',
      timeValidationErrorKey: '',
    };
  }
  const parsedInputData = parseISO(data);

  const dateValidationErrorKey =
    DateUtils.getDayValidationErrorKey(parsedInputData);
  const timeValidationErrorKey =
    DateUtils.getTimeValidationErrorKey(parsedInputData);
  return {
    dateValidationErrorKey,
    timeValidationErrorKey,
  };
};

type ValuesType = Record<string, unknown>;

/**
 * This function is used to remove invisible characters from strings before validation and submission.
 */
function prepareValues(values: ValuesType): ValuesType {
  const trimmedStringValues: ValuesType = {};

  for (const [inputID, inputValue] of Object.entries(values)) {
    if (typeof inputValue === 'string') {
      trimmedStringValues[inputID] =
        StringUtils.removeInvisibleCharacters(inputValue);
    } else {
      trimmedStringValues[inputID] = inputValue;
    }
  }

  return trimmedStringValues;
}

/**
 * Validates the given value if it is correct percentage value.
 */
function isValidPercentage(value: string): boolean {
  const parsedValue = Number(value);
  return !Number.isNaN(parsedValue) && parsedValue >= 0 && parsedValue <= 100;
}

/**
//  * Validates the given value if it is correct tax name.
//  */
// function isExistingTaxName(taxName: string, taxRates: TaxRates): boolean {
//   const trimmedTaxName = taxName.trim();
//   return !!Object.values(taxRates).find(
//     taxRate => taxRate.name === trimmedTaxName,
//   );
// }

export {
  meetsMinimumAgeRequirement,
  meetsMaximumAgeRequirement,
  getAgeRequirementError,
  isValidEmail,
  isComplexPassword,
  //   isValidAddress,
  isValidDate,
  isValidPastDate,
  isValidSecurityCode,
  //   isValidExpirationDate,
  isValidDebitCard,
  isRequiredFulfilled,
  getFieldRequiredErrors,
  isValidWebsite,
  isValidTwoFactorCode,
  //   isNumericWithSpecialChars,
  isValidSessionNote,
  isValidRoutingNumber,
  isValidValidateCode,
  isValidDisplayName,
  doesContainReservedWord,
  isNumeric,
  getDatePassedError,
  isValidRecoveryCode,
  validateDateTimeIsAtLeastOneMinuteInFuture,
  prepareValues,
  isValidPersonName,
  isValidPercentage,
  validateEmail,
  validatePassword,
  validateUsername,
};
