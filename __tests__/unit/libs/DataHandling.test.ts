import type {DateData} from 'react-native-calendars';
import {
  // calculateThisMonthUnits,
  // calculateThisMonthDrinks,
  changeDateBySomeDays,
  dateToDateData,
  formatDate,
  getLastDrinkAddedTime,
  getNextMonth,
  getPreviousMonth,
  getRandomDrinksList,
  getTimestampAtMidnight,
  getTimestampAtNoon,
  getYearMonth,
  getYearMonthVerbose,
  getZeroDrinksList,
  setDateToCurrentTime,
  sumAllDrinks,
  sumDrinkTypes,
  sumDrinksOfSingleType,
  timestampToDate,
  convertUnitsToColors,
} from '@libs/DataHandling';
import type {
  DrinkingSession,
  DrinksList,
  Drinks,
  UnitsToColors,
} from '@src/types/onyx';
import CONST from '@src/CONST';
import {randDrinkingSession} from '../../utils/collections/drinkingSessions';

describe('formatDate function', () => {
  function checkFormattedDate(date: Date, expectedFormattedDate: string) {
    const formattedDate = formatDate(date);
    expect(formattedDate).toEqual(expectedFormattedDate);
    expect(typeof formattedDate).toBe('string');
  }

  it('formats an arbitrary date', () => {
    checkFormattedDate(new Date(2023, 7, 18), '2023-08-18');
  });

  it('formats the first day of the year', () => {
    checkFormattedDate(new Date(2022, 0, 1), '2022-01-01');
  });

  it('formats the last day of the year', () => {
    checkFormattedDate(new Date(2024, 11, 31), '2024-12-31');
  });
});
describe('timestampToDate function', () => {
  function checkTimestampToDateConversion(timestamp: number) {
    const convertedDate = timestampToDate(timestamp);
    expect(convertedDate.getTime()).toEqual(timestamp);
    expect(convertedDate).toBeInstanceOf(Date);
  }

  it('converts a timestamp to a Date object', () => {
    const currentTimestamp = new Date().getTime();
    checkTimestampToDateConversion(currentTimestamp);
  });
});

describe('dateToDateData function', () => {
  function checkDateDataProperties(date: Date, dateData: DateData) {
    const formattedDate = formatDate(date);
    expect(dateData.dateString).toEqual(formattedDate);
    expect(dateData.day).toEqual(date.getDate());
    expect(dateData.month - 1).toEqual(date.getMonth()); // Adjusting for 1-indexed month
    expect(dateData.year).toEqual(date.getFullYear());
    expect(dateData.timestamp).toEqual(date.getTime());
  }

  it('converts a Date object to its corresponding DateData', () => {
    const today = new Date();
    const dateData = dateToDateData(today);
    checkDateDataProperties(today, dateData);
  });
});

describe('getTimestampAtMidnight function', () => {
  function checkTimePropertiesForMidnight(date: Date) {
    expect(date.getHours()).toEqual(0);
    expect(date.getMinutes()).toEqual(0);
    expect(date.getSeconds()).toEqual(0);
    expect(date.getMilliseconds()).toEqual(0);
  }

  it('creates a timestamp corresponding to midnight of a given date', () => {
    const today = new Date();
    const timestampAtMidnight = getTimestampAtMidnight(today);
    const midnightDate = timestampToDate(timestampAtMidnight);
    checkTimePropertiesForMidnight(midnightDate);
    expect(midnightDate.getDate()).toEqual(today.getDate());
  });
});

describe('getTimestampAtNoon function', () => {
  function checkTimePropertiesForNoon(date: Date) {
    expect(date.getHours()).toEqual(12);
    expect(date.getMinutes()).toEqual(0);
    expect(date.getSeconds()).toEqual(0);
    expect(date.getMilliseconds()).toEqual(0);
  }

  it('creates a timestamp corresponding to noon of a given date', () => {
    const today = new Date();
    const timestampAtNoon = getTimestampAtNoon(today);
    const noonDate = timestampToDate(timestampAtNoon);
    checkTimePropertiesForNoon(noonDate);
    expect(noonDate.getDate()).toEqual(today.getDate());
  });
});

describe('changeDateBySomeDays function', () => {
  function checkDateValues(
    actualDate: Date,
    expectedYear: number,
    expectedMonth: number,
    expectedDay: number,
  ) {
    expect(actualDate).toBeInstanceOf(Date);
    expect(actualDate.getFullYear()).toEqual(expectedYear);
    expect(actualDate.getMonth() + 1).toEqual(expectedMonth); // Month is 0-based
    expect(actualDate.getDate()).toEqual(expectedDay);
  }

  it('adds a positive number of days', () => {
    const originalDate = new Date(2023, 7, 15); // 15th August 2023
    const newDate = changeDateBySomeDays(originalDate, 10);
    checkDateValues(newDate, 2023, 8, 25); // Expected: 25th August 2023
  });

  it('subtracts days', () => {
    const originalDate = new Date(2023, 7, 15); // 15th August 2023
    const newDate = changeDateBySomeDays(originalDate, -10);
    checkDateValues(newDate, 2023, 8, 5); // Expected: 5th August 2023
  });

  it('handles month rollover when adding days', () => {
    const originalDate = new Date(2023, 7, 25); // 25th August 2023
    const newDate = changeDateBySomeDays(originalDate, 10);
    checkDateValues(newDate, 2023, 9, 4); // Expected: 4th September 2023
  });

  it('handles month rollback when subtracting days', () => {
    const originalDate = new Date(2023, 7, 5); // 5th August 2023
    const newDate = changeDateBySomeDays(originalDate, -10);
    checkDateValues(newDate, 2023, 7, 26); // Expected: 26th July 2023
  });

  it('handles year change when adding days', () => {
    const originalDate = new Date(2023, 11, 30); // 30th December 2023
    const newDate = changeDateBySomeDays(originalDate, 5);
    checkDateValues(newDate, 2024, 1, 4); // Expected: 4th January 2024
  });

  it('handles year change when subtracting days', () => {
    const originalDate = new Date(2024, 0, 5); // 5th January 2024
    const newDate = changeDateBySomeDays(originalDate, -10);
    checkDateValues(newDate, 2023, 12, 26); // Expected: 26th December 2023
  });
});

describe('getNextMonth function', () => {
  function checkIsDateAndHasExpectedValues(
    acualDate: DateData,
    expectedDay: number,
    expectedMonth: number,
  ) {
    const date = new Date(acualDate.timestamp);
    expect(date).toBeInstanceOf(Date);
    expect(acualDate.day).toEqual(expectedDay);
    expect(acualDate.month).toEqual(expectedMonth);
    expect(acualDate.dateString).toEqual(
      `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`,
    );
  }

  it('shifts a mid-month date to the same day of the next month', () => {
    const originalDateObj: DateData = dateToDateData(new Date(2023, 7, 15));
    const newDateObj = getNextMonth(originalDateObj);
    checkIsDateAndHasExpectedValues(newDateObj, 15, 9); // Expected: September 15
  });

  it('shifts an end-of-month date (with 31 days) to the last day of the next month (with 30 days)', () => {
    const originalDateObj: DateData = dateToDateData(new Date(2023, 6, 31));
    const newDate = getNextMonth(originalDateObj);
    checkIsDateAndHasExpectedValues(newDate, 31, 8); // Expected: August 31 (as August has 31 days)
  });

  it('shifts an end-of-month date (with 31 days) to the last day of the next month (with 28/29 days)', () => {
    const originalDateObj: DateData = dateToDateData(new Date(2023, 0, 31));
    const newDate = getNextMonth(originalDateObj);
    checkIsDateAndHasExpectedValues(newDate, 28, 2); // Expected: February 28 (non-leap year)
  });

  it('shifts an end-of-month date (with 31 days) to the last day of the next month (in a leap year)', () => {
    const originalDateObj: DateData = dateToDateData(new Date(2024, 0, 31));
    const newDate = getNextMonth(originalDateObj);
    checkIsDateAndHasExpectedValues(newDate, 29, 2); // Expected: February 29 (leap year)
  });

  it('shifts an end-of-month date (with 30 days) to the same day of the next month (with 31 days)', () => {
    const originalDateObj: DateData = dateToDateData(new Date(2023, 3, 30));
    const newDate = getNextMonth(originalDateObj);
    checkIsDateAndHasExpectedValues(newDate, 30, 5); // Expected: May 30 (as May has 31 days)
  });
});

describe('getYearMonth', () => {
  it('should correctly format year and month for valid dates', () => {
    const testCases: Array<{input: Date; expected: string}> = [
      {input: new Date(2023, 7), expected: '2023-08'}, // 0-indexed vs 1-indexed
      {input: new Date(2021, 1), expected: '2021-02'},
      {input: new Date(1999, 11), expected: '1999-12'},
      {input: new Date(2000, 0), expected: '2000-01'},
    ];

    testCases.forEach(({input, expected}) => {
      const dateData = dateToDateData(input);
      expect(getYearMonth(dateData)).toBe(expected);
    });
  });

  it('should handle month values with single digits', () => {
    const dateData: DateData = dateToDateData(new Date(2023, 4));
    expect(getYearMonth(dateData)).toBe('2023-05');
  });

  it('should handle month values with two digits', () => {
    const dateData: DateData = dateToDateData(new Date(2023, 9));
    expect(getYearMonth(dateData)).toBe('2023-10');
  });
});

describe('getYearMonthVerbose', () => {
  it('should return full month name by default', () => {
    const date: DateData = dateToDateData(new Date(2023, 9));
    expect(getYearMonthVerbose(date)).toBe('October 2023');
  });

  it('should return abbreviated month name when specified', () => {
    const date: DateData = dateToDateData(new Date(2023, 9));
    expect(getYearMonthVerbose(date, true)).toBe('Oct 2023');
  });

  it('should handle all months correctly', () => {
    for (let i = 0; i < 12; i++) {
      const date: DateData = dateToDateData(new Date(2023, i));
      expect(getYearMonthVerbose(date)).toBe(`${CONST.MONTHS[i]} 2023`);
      expect(getYearMonthVerbose(date, true)).toBe(
        `${CONST.MONTHS_ABBREVIATED[i]} 2023`,
      );
    }
  });
});

describe('getPreviousMonth function', () => {
  function checkDateValues(
    actualDate: DateData,
    expectedYear: number,
    expectedMonth: number,
    expectedDay: number,
  ) {
    const date = new Date(actualDate.timestamp);
    expect(date).toBeInstanceOf(Date);
    expect(actualDate).toBeDefined();
    expect(actualDate.year).toEqual(expectedYear);
    expect(actualDate.month).toEqual(expectedMonth); // Month is 1-based in DateData
    expect(actualDate.day).toEqual(expectedDay);
    expect(actualDate.dateString).toEqual(
      `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`,
    );
  }

  it('handles normal month rollback', () => {
    const originalDateObj: DateData = dateToDateData(new Date(2023, 7, 15));
    const newDate = getPreviousMonth(originalDateObj);
    checkDateValues(newDate, 2023, 7, 15); // Expected: 15th July 2023
  });

  it('handles end-of-month to month with fewer days (31 to 30)', () => {
    const originalDateObj: DateData = dateToDateData(new Date(2023, 7, 31));
    const newDate = getPreviousMonth(originalDateObj);
    checkDateValues(newDate, 2023, 7, 31); // Expected: 31st July 2023
  });

  it('handles end-of-month to month with fewer days (31 to 28)', () => {
    const originalDateObj: DateData = dateToDateData(new Date(2023, 2, 31));
    const newDate = getPreviousMonth(originalDateObj);
    checkDateValues(newDate, 2023, 2, 28); // Expected: 28th February 2023 (non-leap year)
  });

  it('handles end-of-month to month with fewer days (31 to 29 in leap year)', () => {
    const originalDateObj: DateData = dateToDateData(new Date(2024, 2, 31));
    const newDate = getPreviousMonth(originalDateObj);
    checkDateValues(newDate, 2024, 2, 29); // Expected: 29th February 2024 (leap year)
  });

  it('handles year change', () => {
    const originalDateObj: DateData = dateToDateData(new Date(2024, 0, 1));
    const newDate = getPreviousMonth(originalDateObj);
    checkDateValues(newDate, 2023, 12, 1); // Expected: 1st December 2023
  });
});

describe('setDateToCurrentTime function', () => {
  it('should change the time to current while keeping the date component the same', () => {
    const inputDate = new Date(2023, 7, 15, 5, 5, 5); // 15th August 2023, 05:05:05
    const modifiedDate = setDateToCurrentTime(inputDate);

    const currentTime = new Date();

    expect(modifiedDate.getFullYear()).toEqual(2023);
    expect(modifiedDate.getMonth()).toEqual(7);
    expect(modifiedDate.getDate()).toEqual(15);
    expect(modifiedDate.getHours()).toEqual(currentTime.getHours());
    expect(modifiedDate.getMinutes()).toEqual(currentTime.getMinutes());
    expect(modifiedDate.getSeconds()).toEqual(currentTime.getSeconds());
  });
});

describe('sumAllDrinks', () => {
  it('should correctly sum up all drinks', () => {
    const sampleDrinks: DrinksList = getRandomDrinksList();

    const result = sumAllDrinks(sampleDrinks);
    const expectedSum = Object.values(sampleDrinks).reduce(
      (total, drinkTypes) => {
        return (
          total +
          Object.values(drinkTypes).reduce(
            (subTotal, drinkCount) => subTotal + (drinkCount || 0),
            0,
          )
        );
      },
      0,
    );
    expect(result).toBe(expectedSum);
  });

  it('should return 0 if all drinks are 0', () => {
    const zeroDrinks = getZeroDrinksList();
    const result = sumAllDrinks(zeroDrinks);
    expect(result).toBe(0);
  });
});

describe('sumDrinksOfSingleType function', () => {
  let drinksData: DrinksList;

  beforeEach(() => {
    drinksData = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      1632423423: {
        beer: 2,
        cocktail: 1,
        other: 3,
      },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      1632434223: {
        other: 3,
      },
    };
  });

  it('should return sum of specified drink type across all sessions', () => {
    expect(sumDrinksOfSingleType(drinksData, 'beer')).toBe(2);
    expect(sumDrinksOfSingleType(drinksData, 'cocktail')).toBe(1);
    expect(sumDrinksOfSingleType(drinksData, 'other')).toBe(6);
  });

  it('should return 0 if drink type does not exist in any of the sessions', () => {
    expect(sumDrinksOfSingleType(drinksData, 'wine')).toBe(0);
  });

  it('should return 0 if drinksList is empty', () => {
    const emptyDrinksData: DrinksList = {};
    expect(sumDrinksOfSingleType(emptyDrinksData, 'beer')).toBe(0);
  });

  it('should handle a mix of existing and non-existing drink types', () => {
    drinksData[1632434223].wine = 5;
    expect(sumDrinksOfSingleType(drinksData, 'wine')).toBe(5);
  });

  it('should handle undefined values without throwing errors', () => {
    drinksData[1632434223] = {
      beer: undefined,
      wine: 5,
    };
    expect(sumDrinksOfSingleType(drinksData, 'beer')).toBe(2);
  });
});

describe('sumDrinkTypes', () => {
  it('should correctly sum drinks of multiple types', () => {
    const testDrinks = {
      beer: 2,
      cocktail: 1,
      wine: 3,
    };

    const result = sumDrinkTypes(testDrinks);
    expect(result).toBe(6);
  });

  it('should return 0 for an empty units object', () => {
    const testDrinks = {};

    const result = sumDrinkTypes(testDrinks);
    expect(result).toBe(0);
  });

  it('should handle missing drink types correctly', () => {
    const testDrinks = {
      beer: 2,
      wine: 3,
      // No cocktail, strong_shot, weak_shot, or other
    };

    const result = sumDrinkTypes(testDrinks);
    expect(result).toBe(5);
  });

  it('should treat undefined drink counts as 0', () => {
    const testDrinks = {
      beer: 2,
      cocktail: undefined,
      wine: 3,
    };

    const result = sumDrinkTypes(testDrinks);
    expect(result).toBe(5);
  });
});

describe('getLastDrinkAddedTime', () => {
  let mockSession: DrinkingSession;

  beforeEach(() => {
    mockSession = randDrinkingSession(new Date().getTime());
  });

  it('should correctly identify last added drink timestamp', () => {
    const sessionStart = mockSession.start_time;
    const testDrinks: DrinksList = {
      [sessionStart + 10]: {
        beer: 2,
      },
      [sessionStart + 20]: {
        wine: 3,
        other: 1,
      },
    };
    mockSession.drinks = testDrinks;

    const lastDrinkAddedTime = getLastDrinkAddedTime(mockSession);
    expect(lastDrinkAddedTime).toBe(sessionStart + 20);
  });

  it('should return null for an empty units object', () => {
    const testDrinks = {};
    mockSession.drinks = testDrinks;

    const result = getLastDrinkAddedTime(mockSession);
    expect(result).toBe(null);
  });
});

// TODO enable this
// describe('calculateThisMonthDrinks', () => {
//   const currentDate = new Date();
//   const mockDateData: DateData = dateToDateData(currentDate);
//   const twoBeers: Drinks = createMockDrinksList({beer: 2});
//   const threeWines: Drinks = createMockDrinksList({wine: 3});
//   const fourOther: Drinks = createMockDrinksList({other: 4});

//   it('should return 0 when there are no drinking sessions this month', () => {
//     const result = calculateThisMonthDrinks(mockDateData, []);
//     expect(result).toBe(0);
//   });

//   it('should sum drinks for sessions that only fall within the current month', () => {
//     const testSessions: DrinkingSessionArray = [
//       createMockSession(new Date(), -31, twoBeers),
//       createMockSession(new Date(), 31, twoBeers),
//       createMockSession(new Date(), 0, threeWines),
//       createMockSession(new Date(), 0, twoBeers),
//     ];

//     const result = calculateThisMonthDrinks(mockDateData, testSessions);
//     expect(result).toBe(5); // 3 + 2
//   });

//   it('should sum drinks for all sessions if all fall within the current month', () => {
//     // Mock sumAllDrinks function and getSingleMonthDrinkingSessions to return an array of sessions
//     const testSessions: DrinkingSessionArray = [
//       createMockSession(new Date(), 0, threeWines),
//       createMockSession(new Date(), 0, twoBeers),
//       createMockSession(new Date(), 0, fourOther),
//     ];

//     const result = calculateThisMonthDrinks(mockDateData, testSessions);
//     expect(result).toBe(9); // 4 + 3 + 2
//   });
// });

// describe('calculateThisMonthUnits', () => {
//   const mockPreferences: Preferences = createMockPreferences();
//   const mockDrinksToUnits = mockPreferences.drinks_to_units;
//   mockDrinksToUnits.beer = 1;
//   mockDrinksToUnits.weak_shot = 0.5;
//   mockDrinksToUnits.other = 1;
//   const currentDate = new Date();
//   const mockDateData: DateData = dateToDateData(currentDate);
//   const twoBeers: DrinksList = createMockDrinksList({beer: 2});
//   const threeWeakShots: DrinksList = createMockDrinksList({weak_shot: 3});
//   const fourOther: DrinksList = createMockDrinksList({other: 4});

//   it('should return 0 when there are no drinking sessions this month', () => {
//     const result = calculateThisMonthUnits(mockDateData, [], mockDrinksToUnits);
//     expect(result).toBe(0);
//   });

//   it('should sum drinks for sessions that only fall within the current month', () => {
//     const testSessions: DrinkingSessionArray = [
//       createMockSession(new Date(), -31, twoBeers),
//       createMockSession(new Date(), 31, twoBeers),
//       createMockSession(new Date(), 0, threeWeakShots),
//       createMockSession(new Date(), 0, twoBeers),
//     ];

//     const result = calculateThisMonthUnits(
//       mockDateData,
//       testSessions,
//       mockDrinksToUnits,
//     );
//     expect(result).toBe(3.5); // 3 * 0.5 + 2 * 1
//   });

//   it('should sum drinks for all sessions if all fall within the current month', () => {
//     // Mock sumAllDrinks function and getSingleMonthDrinkingSessions to return an array of sessions
//     const testSessions: DrinkingSessionArray = [
//       createMockSession(new Date(), 0, threeWeakShots),
//       createMockSession(new Date(), 0, twoBeers),
//       createMockSession(new Date(), 0, fourOther),
//     ];

//     const result = calculateThisMonthUnits(
//       mockDateData,
//       testSessions,
//       mockDrinksToUnits,
//     );
//     expect(result).toBe(7.5); // 3 * 0.5 + 2 * 1 + 4 * 1
//   });
// });

// describe('addDrinks function', () => {
//   let existingDrinks: DrinksList;

//   beforeEach(() => {
//     existingDrinks = {
//       1632423423: {
//         beer: 2,
//         cocktail: 1,
//         other: 3,
//       },
//       1632434223: {
//         other: 3,
//       },
//     };
//   });

//   it('should add new drinks with a new timestamp', () => {
//     const drinksToAdd: Drinks = {beer: 4, wine: 2};
//     const newDrinks = addDrinks(existingDrinks, drinksToAdd)!;
//     const newTimestamps = Object.keys(newDrinks).map(Number);

//     // Expect that there is one more session than before
//     expect(newTimestamps.length).toBe(Object.keys(existingDrinks).length + 1);

//     // Expect the most recent session data to match drinksToAdd
//     const mostRecentTimestamp = Math.max(...newTimestamps);
//     expect(newDrinks[mostRecentTimestamp]).toEqual(drinksToAdd);
//   });

//   it('should keep all existing drinks unchanged', () => {
//     const drinksToAdd: Drinks = {beer: 4, wine: 2};
//     const newDrinks = addDrinks(existingDrinks, drinksToAdd)!;

//     Object.keys(existingDrinks).forEach(timestamp => {
//       expect(newDrinks[Number(timestamp)]).toEqual(
//         existingDrinks[Number(timestamp)],
//       );
//     });
//   });

//   it('should handle empty drinks to add', () => {
//     const drinksToAdd: Drinks = {};
//     const newDrinks = addDrinks(existingDrinks, drinksToAdd)!;
//     expect(newDrinks).toEqual(existingDrinks);
//   });

//   it('should handle undefined values in drinks to add', () => {
//     const drinksToAdd: Drinks = {beer: undefined, wine: 2};
//     const newDrinks = addDrinks(existingDrinks, drinksToAdd)!;
//     const newTimestamps = Object.keys(newDrinks).map(Number);

//     // Expect that there is one more session than before
//     expect(newTimestamps.length).toBe(Object.keys(existingDrinks).length + 1);

//     // Expect the most recent session data to match drinksToAdd
//     const mostRecentTimestamp = Math.max(...newTimestamps);
//     expect(newDrinks[mostRecentTimestamp]).toEqual(drinksToAdd);
//   });
// });

// describe('removeDrinks function', () => {
//   let existingDrinks: DrinksList;

//   beforeEach(() => {
//     existingDrinks = {
//       1632423423: {
//         beer: 4,
//         cocktail: 2,
//       },
//       1632434223: {
//         beer: 3,
//       },
//       1632435223: {
//         cocktail: 1,
//       },
//     };
//   });

//   it('should remove drinks starting from the most recent session', () => {
//     const newDrinks = removeDrinks(existingDrinks, 'beer', 5)!;
//     expect(newDrinks[1632434223]).toBeUndefined();
//     expect(newDrinks[1632423423]?.beer).toBe(2);
//   });

//   it('should remove all drinks if the count equals the total', () => {
//     const newDrinks = removeDrinks(existingDrinks, 'beer', 7)!;
//     expect(newDrinks[1632434223]).toBeUndefined();
//     expect(newDrinks[1632423423]?.beer).toBeUndefined();
//   });

//   it('should handle removing more drinks than exist', () => {
//     const newDrinks = removeDrinks(existingDrinks, 'beer', 10)!;
//     expect(newDrinks[1632434223]).toBeUndefined();
//     expect(newDrinks[1632423423]?.beer).toBeUndefined();
//   });

//   it('should not modify other drink types when removing drinks', () => {
//     const newDrinks = removeDrinks(existingDrinks, 'beer', 5)!;
//     expect(newDrinks[1632423423]?.cocktail).toBe(2);
//     expect(newDrinks[1632435223]?.cocktail).toBe(1);
//     expect(sumDrinksOfSingleType(newDrinks, 'cocktail')).toBe(3);
//   });

//   it('should remove 0 drinks if the count is 0', () => {
//     const newDrinks = removeDrinks(existingDrinks, 'beer', 0);
//     expect(newDrinks).toEqual(existingDrinks);
//   });

//   it('should clean up sessions that have zero drinks left', () => {
//     const newDrinks = removeDrinks(existingDrinks, 'cocktail', 3)!;
//     expect(newDrinks[1632423423]?.cocktail).toBeUndefined();
//     expect(newDrinks[1632435223]).toBeUndefined();
//   });
// });

describe('getRandomDrinksList', () => {
  let randomDrinksList: DrinksList = {};
  let randomDrinks: Drinks = {};

  beforeEach(() => {
    randomDrinksList = getRandomDrinksList(30);
    randomDrinks = Object.values(randomDrinksList)[0];
  });

  it('should return an object with all values between 0 and maxDrinkValue (exclusive)', () => {
    for (const drink in randomDrinks) {
      if (Object.hasOwn(randomDrinks, drink)) {
        expect(randomDrinks[drink as keyof Drinks]).toBeGreaterThanOrEqual(0);
        expect(randomDrinks[drink as keyof Drinks]).toBeLessThanOrEqual(30);
      }
    }
  });

  it('should have all the expected keys based on DrinkKey type', () => {
    const expectedKeys = Object.values(CONST.DRINKS.KEYS);

    expect(Object.keys(randomDrinks)).toEqual(expectedKeys);
  });
});

describe('getZeroDrinksList', () => {
  let zeroDrinksList: DrinksList = {};
  let zeroDrinks: Drinks = {};

  beforeEach(() => {
    zeroDrinksList = getZeroDrinksList();
    zeroDrinks = Object.values(zeroDrinksList)[0];
  });

  it('should return an object with all values equal to 0', () => {
    Object.values(zeroDrinks).forEach(drink => {
      expect(drink).toEqual(0);
    });
  });

  it('should have all the expected keys based on Drinks type', () => {
    const expectedKeys = Object.values(CONST.DRINKS.KEYS);

    expect(Object.keys(zeroDrinks)).toEqual(expectedKeys);
  });
});

describe('unitsToColors', () => {
  // Create a mock for UnitsToColors for consistent testing
  const mockUnitsToColors: UnitsToColors = {
    yellow: 2,
    orange: 4,
  };

  it('should return green for 0 units', () => {
    expect(convertUnitsToColors(0, mockUnitsToColors)).toBe('green');
  });

  it('should return yellow for units up to yellow limit', () => {
    expect(convertUnitsToColors(1, mockUnitsToColors)).toBe('yellow');
    expect(convertUnitsToColors(2, mockUnitsToColors)).toBe('yellow');
  });

  it('should return orange for units between yellow and orange limits', () => {
    expect(convertUnitsToColors(3, mockUnitsToColors)).toBe('orange');
    expect(convertUnitsToColors(4, mockUnitsToColors)).toBe('orange');
  });

  it('should return red for units above the orange limit', () => {
    expect(convertUnitsToColors(5, mockUnitsToColors)).toBe('red');
    expect(convertUnitsToColors(6, mockUnitsToColors)).toBe('red');
  });
});
