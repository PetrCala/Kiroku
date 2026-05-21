import type {DateData} from 'react-native-calendars';
import type {DateString} from '@src/types/onyx/OnyxCommon';
import type {
  CalendarColors,
  SessionsCalendarDayMarking,
} from '@components/SessionsCalendar/types';
import type {
  DrinkingSession,
  DrinkingSessionArray,
  DrinkingSessionList,
  Preferences,
  SessionColorPalette,
  UnitsToColors,
  DrinksToUnits,
  DrinksList,
  DrinkKey,
  Drinks,
} from '@src/types/onyx';
import CONST from '@src/CONST';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import _ from 'lodash';
import type {TranslationPaths} from '@src/languages/types';
import * as DSUtils from './DrinkingSessionUtils';
import {getRandomInt} from './Choice';
import {isLightHex, resolvePalette} from './SessionColorPalettes';

function formatDate(date: Date): DateString {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}` as DateString;
}

/** Convert a timestamp to a Date object */
function timestampToDate(timestamp: number): Date {
  return new Date(timestamp);
}

/** Convert a Date type object to a JSON-type DateData.
 * Month is indexed from 1 in this object
 *
 * @param date Date type object
 * @returns A DateData
 */
function dateToDateData(date: Date): DateData {
  const dateData = {
    dateString: formatDate(date),
    day: date.getDate(),
    month: date.getMonth() + 1,
    timestamp: date.getTime(),
    year: date.getFullYear(),
  };
  return dateData;
}

/**
 * Convert a timestamp to a date string.
 *
 * @param timestamp Timestamp
 * @returns Date string
 */
function timestampToDateString(timestamp: number): DateString {
  return formatDate(timestampToDate(timestamp));
}

/** Inverse of timestampToDate, sets time to midnight
 */
function getTimestampAtMidnight(date: Date): number {
  const dateAtMidnight = new Date(date);
  dateAtMidnight.setHours(0, 0, 0, 0);
  return dateAtMidnight.getTime();
}

function getTimestampAtNoon(date: Date): number {
  const dateAtMidnight = new Date(date);
  dateAtMidnight.setHours(12, 0, 0, 0);
  return dateAtMidnight.getTime();
}

function dateStringToDate(dateString: DateString): Date {
  return new Date(dateString);
}

/** Input a Date type object and change its day by a certain amount
 *
 * @param date Date type object
 * @param days Number of days to change the date by
 * @returns A new, modified Date type object
 */
function changeDateBySomeDays(date: Date, days: number): Date {
  const newDate = new Date(date); // to avoid mutating original date
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

/** Input a DateData and change it to the following month.
 *
 * @param currentDate Current date as a DateData
 * @returns Next month's date as a DateData
 */
const getNextMonth = (currentDate: DateData): DateData => {
  // Setting it to the same day of the next month
  const newDate = new Date(
    currentDate.year,
    currentDate.month - 1,
    currentDate.day,
  );
  const originalMonth = newDate.getMonth();

  newDate.setMonth(originalMonth + 1);
  // If the day got changed because the next month doesn't have that day (e.g. 31 Aug to 1 Sep)
  if ((newDate.getMonth() - originalMonth + 12) % 12 !== 1) {
    newDate.setDate(0); // Setting the date to the last day of the previous month
  }

  return dateToDateData(newDate);
};

/** Input a DateData and change it to the previous month.
 *
 * @param currentDate Current date as a DateData
 * @returns Previous month's date as a DateData
 */
const getPreviousMonth = (currentDate: DateData): DateData => {
  // Setting it to the same day of the previous month
  const newDate = new Date(
    currentDate.year,
    currentDate.month - 1,
    currentDate.day,
  );
  const originalMonth = newDate.getMonth();

  newDate.setMonth(originalMonth - 1);

  // If the day got changed because the previous month doesn't have that day (e.g., 31st March to something not 31st February)
  if ((newDate.getMonth() - originalMonth + 12) % 12 !== 11) {
    newDate.setDate(0); // Setting the date to the last day of the previous month
  }

  return dateToDateData(newDate);
};

/**
 * Returns an array of DateDatas representing months adjacent to the input DateData.
 * The number of months returned before and after the input month is determined by the input number `n`.
 *
 * For example, if given a DateData for September and n = 2, the returned array will have
 * DateDatas for July, August, September, October, and November.
 *
 * @param currentDate - The reference date from which adjacent months are computed.
 * @param n - The number of months to compute before and after the `currentDate`.
 *
 * @returns - An array of DateDatas, including the `currentDate` and `n` months before and after it.
 *
 * @example
 * const inputDate: DateData = {
 *     dateString: '2023-09-15',
 *     day: 15,
 *     month: 9,
 *     timestamp: 1684560000000,
 *     year: 2023,
 * };
 * const outputDates = getAdjacentMonths(inputDate, 2);
 * console.log(outputDates);
 * // Expected output: DateDatas for July, August, September, October, and November of 2023.
 */
const getAdjacentMonths = (currentDate: DateData, n: number): DateData[] => {
  const result: DateData[] = [currentDate]; // Start with the input date

  // Add next n months
  let nextDate = currentDate;
  for (let i = 0; i < n; i++) {
    nextDate = getNextMonth(nextDate);
    result.push(nextDate);
  }

  // Add previous n months
  let prevDate = currentDate;
  for (let i = 0; i < n; i++) {
    prevDate = getPreviousMonth(prevDate);
    result.unshift(prevDate); // Add to the beginning
  }

  return result;
};

/** Using a date object, return a year-month string in the format YYYY-MM.
 *
 * @param dateData Date object
 * @returns Year-Month string, e.g. '2023-08'
 *
 * @example let yearMonth = getYearMonth(testDateData);
 */
function getYearMonth(dateData: DateData): string {
  return `${dateData.year}-${String(dateData.month).padStart(2, '0')}`;
}

/**
 * Returns a string representation of the month and year in the format "MMM/YYYY" or with full month names (default)
 *
 * @param dateData - An object containing numeric values for 'year' and 'month'.
 * @param abbreviated - If true, return the months in the abbreviated format, returns to false.
 * @returns - A string in the format "MMM/YYYY", where "MMM" is the abbreviated or full month name.
 *
 * @example
 * const date = { year: 2023, month: 10 };
 * getYearMonthVerbose(date, true); // Returns "Oct/2023"
 */
function getYearMonthVerbose(dateData: DateData, abbreviated = false): string {
  const months = abbreviated ? CONST.MONTHS_ABBREVIATED : CONST.MONTHS;
  const monthName = months[dateData.month - 1];
  return `${monthName} ${dateData.year}`;
}

/** Change the time of a datetime object to now,
 * keeping the date constant.
 */
function setDateToCurrentTime(inputDate: Date): Date {
  const currentTime = new Date();

  inputDate.setHours(currentTime.getHours());
  inputDate.setMinutes(currentTime.getMinutes());
  inputDate.setSeconds(currentTime.getSeconds());
  inputDate.setMilliseconds(currentTime.getMilliseconds());

  return inputDate;
}

/** Based on a collection of DrinkingSession objects, determine a day marking and return it as an object. */
function sessionsToDayMarking(
  sessions: DrinkingSessionArray,
  preferences: Preferences,
): SessionsCalendarDayMarking | null {
  if (isEmptyObject(sessions)) {
    return null;
  }
  const totalUnits = sessions.reduce(
    (sum, session) =>
      sum +
      DSUtils.calculateTotalUnits(session.drinks, preferences.drinks_to_units),
    0,
  );

  const hasBlackout = sessions.some(obj => obj.blackout === true);
  const palette = resolvePalette(preferences.session_color_palette);
  const color: CalendarColors = hasBlackout
    ? palette.black
    : convertUnitsToColors(
        totalUnits,
        preferences.units_to_colors,
        preferences.session_color_palette,
      );

  // Determine text color based on background color luminance
  const textColor = isLightHex(color)
    ? CONST.CALENDAR_COLORS.TEXT.BLACK
    : CONST.CALENDAR_COLORS.TEXT.WHITE;

  const markingObject: SessionsCalendarDayMarking = {
    units: totalUnits,
    marking: {
      color,
      textColor,
    },
  };

  return markingObject;
}

/** Sum up all drinks regardless of category
 *
 * @param all_drinks Drinks to sum up.
 */
function sumAllDrinks(drinks: DrinksList | undefined): number {
  if (isEmptyObject(drinks)) {
    return 0;
  }
  return Object.values(drinks).reduce(
    (total, drinkTypes) =>
      total +
      Object.values(drinkTypes).reduce(
        (subTotal, drinkCount) => subTotal + (drinkCount ?? 0),
        0,
      ),
    0,
  );
}

/** Sum up drinks of a specific type of alcohol across multiple sessions
 *
 * @param drinksOjbect DrinksList to sum up.
 * @param drinkType The type of drink to sum.
 */
function sumDrinksOfSingleType(
  drinksObject: DrinksList | undefined,
  drinkType: DrinkKey,
): number {
  if (!drinksObject) {
    return 0;
  }
  return Object.values(drinksObject).reduce(
    (total, session) => total + (session[drinkType] ?? 0),
    0,
  );
}

/** Sum up drinks of a single Drink type object.
 *
 * @param drinkTypes A Drinks kind of object
 * @returns The sum
 */
function sumDrinkTypes(drinkTypes: Drinks): number {
  if (!drinkTypes) {
    return 0;
  }
  return Object.values(drinkTypes).reduce(
    (total, drinksCount) => total + (drinksCount ?? 0),
    0,
  );
}

/** Get an array of unique keys that appear in a session */
function getUniqueDrinkTypesInSession(
  session: DrinkingSession,
): DrinkKey[] | undefined {
  const sessionDrinks = session?.drinks;
  if (!sessionDrinks) {
    return undefined;
  }
  const uniqueKeys = new Set<DrinkKey>();

  // Iterate over each Drinks entry in the DrinksList
  for (const drinks of Object.values(sessionDrinks)) {
    // Iterate over each DrinkKey in the current Drinks object
    for (const key of Object.keys(drinks) as DrinkKey[]) {
      uniqueKeys.add(key);
    }
  }

  // Convert the Set to an array before returning
  return Array.from(uniqueKeys);
}

/** Input a session item and return the timestamp of the last drink
 * consumed in that session.
 *
 * @param session Drinking session array item
 * @returnsTimestamp of the last drink consumed
 */
function getLastDrinkAddedTime(session: DrinkingSession): number | null {
  if (_.isEmpty(session?.drinks)) {
    return null;
  }
  const timestamps = Object.keys(session.drinks).map(Number);
  // Return the maximum timestamp or null if there aren't any
  return timestamps.length ? Math.max(...timestamps) : null;
}

/** Out of an array of session items, return an a session that is ongoing. If there is no such session, return null
 */
function findOngoingSession(
  sessions: DrinkingSessionList,
): DrinkingSession | null {
  if (isEmptyObject(sessions)) {
    return null;
  }
  const ongoingSession = Object.values(sessions).find(
    session => session.ongoing === true,
  );
  return ongoingSession ?? null;
}

/** Enter a dateData and an array of drinking sessions and calculate
 * drinks consumed in the current month.
 *
 * @param dateData DateData
 * @param sessions Array of drinking sessions
 * @returns Number of drinks consumed during the current month
 */
const calculateThisMonthDrinks = (
  dateData: DateData,
  sessions: DrinkingSessionArray,
): number => {
  // Subset to this month's sessions only
  const currentDate = timestampToDate(dateData.timestamp);
  const sessionsThisMonth = DSUtils.getSingleMonthDrinkingSessions(
    currentDate,
    sessions,
    false,
  );
  // Sum up the units
  return sessionsThisMonth.reduce(
    (sum, session) => sum + sumAllDrinks(session.drinks),
    0,
  );
};

/** Enter a dateData and an array of drinking sessions and calculate
 * units for drinks consumed in the current month.
 *
 * @param dateData DateData
 * @param sessions Array of drinking sessions
 * @param drinksToUnits Drinks to units conversion object
 * @returns Number of units consumed during the current month
 */
const calculateThisMonthUnits = (
  dateData: DateData,
  sessions: DrinkingSessionArray,
  drinksToUnits: DrinksToUnits,
): number => {
  if (!sessions) {
    return 0;
  }
  // Subset to this month's sessions only
  const currentDate = timestampToDate(dateData.timestamp);
  const sessionsThisMonth = DSUtils.getSingleMonthDrinkingSessions(
    currentDate,
    sessions,
    false,
  );
  // Sum up the drinks
  return sessionsThisMonth.reduce(
    (sum, session) =>
      sum + DSUtils.calculateTotalUnits(session.drinks, drinksToUnits),
    0,
  );
};

function getLastStartedSession(
  sessions: DrinkingSessionList | undefined,
): DrinkingSession | undefined {
  if (!sessions) {
    return undefined;
  }
  return _.maxBy(Object.values(sessions), 'start_time');
}

function getLastStartedSessionId(
  sessions: DrinkingSessionList | undefined,
): string | undefined {
  if (!sessions) {
    return undefined;
  }

  const latestSession = _.maxBy(
    Object.entries(sessions),
    ([, sessionValue]) => sessionValue.start_time,
  );

  // Return the key (session ID) of the latest session, if it exists
  return latestSession ? latestSession[0] : undefined;
}

/** Generate an object with all available drinks where
 * each drink's value is set to a random integer.
 */

const getRandomDrinksList = (maxDrinkValue = 30): DrinksList => {
  const drinkWithRandomValues: Drinks = {};

  // Loop over each item in DrinkTypesKeys and set its value to a random number between 0 and maxDrinkValue
  for (const key of Object.values(CONST.DRINKS.KEYS)) {
    drinkWithRandomValues[key] = getRandomInt(0, maxDrinkValue);
  }

  // Create a new object with a current timestamp
  const timestamp = Date.now();
  const result: DrinksList = {
    [timestamp]: drinkWithRandomValues,
  };

  return result;
};

/** Generate an object with all available drinks where each drink's value is set to 0.
 */
function getZeroDrinksList(): DrinksList {
  return getRandomDrinksList(0);
}

/** Convert the units consumed to colors.
 *
 * @param units Number of units consumed
 * @param unitsToColors Information about limits for different colors
 * @returns String
 */
function convertUnitsToColors(
  units: number,
  unitsToColors: UnitsToColors | undefined,
  palette?: SessionColorPalette,
): CalendarColors {
  const p = resolvePalette(palette);
  if (!unitsToColors) {
    return p.green;
  }
  if (units === 0) {
    return p.green;
  }
  if (units <= unitsToColors.yellow) {
    return p.yellow;
  }
  if (units <= unitsToColors.orange) {
    return p.orange;
  }
  return p.red;
}

/** Insert the key of a drink and find its matching verbose name.
 *
 * @returns The verbose name of that drink.
 */
const findDrinkNameTranslationKey = (key: DrinkKey): TranslationPaths => {
  const drinkKeyToTranslationKey: Record<DrinkKey, string> = {
    [CONST.DRINKS.KEYS.SMALL_BEER]: 'smallBeer',
    [CONST.DRINKS.KEYS.BEER]: 'beer',
    [CONST.DRINKS.KEYS.WINE]: 'wine',
    [CONST.DRINKS.KEYS.WEAK_SHOT]: 'weakShot',
    [CONST.DRINKS.KEYS.STRONG_SHOT]: 'strongShot',
    [CONST.DRINKS.KEYS.COCKTAIL]: 'cocktail',
    [CONST.DRINKS.KEYS.OTHER]: 'other',
  };
  const translationKey = drinkKeyToTranslationKey[key];
  return `drinks.${translationKey}` as TranslationPaths;
};

/**
 * Checks if a number has a decimal point.
 * @param number - The number to check.
 * @returns True if the number has a decimal point, false otherwise.
 */
function hasDecimalPoint(number: number): boolean {
  const numberAsString = number.toString();
  return numberAsString.includes('.');
}

function toPercentageVerbose(number: number): string {
  if (number > 1 || number < 0) {
    throw new Error('A fraction number must be between 0 and 1.');
  }
  const percentage = number * 100;
  return `${percentage.toFixed(2).toString()}%`;
}

/**
 * Returns an array of keys from the provided object.
 * @param obj - The object to retrieve keys from.
 * @returns An array of keys from the object.
 */
function objKeys(obj: Record<string, unknown> | null | undefined): string[] {
  // Check if obj is an object and not null
  if (obj && typeof obj === 'object') {
    return Object.keys(obj);
  }
  // Return an empty array for non-object inputs or null
  return [];
}

export {
  formatDate,
  timestampToDate,
  timestampToDateString,
  dateToDateData,
  getTimestampAtMidnight,
  getTimestampAtNoon,
  dateStringToDate,
  changeDateBySomeDays,
  getNextMonth,
  getPreviousMonth,
  getAdjacentMonths,
  getYearMonth,
  getYearMonthVerbose,
  setDateToCurrentTime,
  sessionsToDayMarking,
  sumAllDrinks,
  sumDrinksOfSingleType,
  sumDrinkTypes,
  getUniqueDrinkTypesInSession,
  getLastDrinkAddedTime,
  findOngoingSession,
  calculateThisMonthDrinks,
  calculateThisMonthUnits,
  getLastStartedSession,
  getLastStartedSessionId,
  getRandomDrinksList,
  getZeroDrinksList,
  convertUnitsToColors,
  findDrinkNameTranslationKey,
  hasDecimalPoint,
  toPercentageVerbose,
  objKeys,
};

// test, getAdjacentMonths, findongoingsession, aggregatesessionsbydays, month entries to colors (move these maybe to a different location), toPercentageVerbose
