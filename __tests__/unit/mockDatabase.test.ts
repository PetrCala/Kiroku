import {
  initializeEmptyMockDatabase,
  createMockConfig,
  createMockFeedback,
  createMockDrinksList,
  createMockSession,
  createMockPreferences,
  createMockUnconfirmedDays,
  createMockUserData,
  createMockDatabase,
  createMockMaintenance,
  createMockAppSettings,
} from '../../src/database/MockDatabase';
import type {
  DatabaseProps,
  Config,
  Feedback,
  DrinkingSessionList,
  DrinksList,
  Drinks,
  Preferences,
  UnconfirmedDays,
  UserProps,
  UnitsToColors,
  UserStatus,
  UserPropsList,
} from '../../src/types/onyx';
import CONST from '@src/CONST';

/** Enter an object that is supposed to be of the Config type and validate it. Return true if it has that type, and false otherwise.
 *
 * @param obj
 * @returns
 */
function validateConfig(obj: any): obj is Config {
  return typeof obj.app_settings.min_supported_version === 'string';
}

/** Using any object, validate that this object is of the Feedback type. If yes, return true, otherwise return false.
 *
 * @param obj Object to validate
 * @returns bool
 */
function isFeedback(obj: any): obj is Feedback {
  return (
    typeof obj.submit_time === 'number' &&
    typeof obj.text === 'string' &&
    typeof obj.user_id === 'string'
    // obj.loginTime instanceof Date &&
  );
}

/** Using an object containing supposed Feedback data, validate that all this data is indeed of the Feedback type. Return true if all data is valid, and false otherwise.
 *
 * @param FeedbackList Data to validate
 * @returns bool
 */
function validateFeedback(FeedbackList: Record<string, any>): boolean {
  for (const feedbackId in FeedbackList) {
    if (!isFeedback(FeedbackList[feedbackId])) {
      return false;
    }
  }
  return true;
}

function isUserStatus(obj: any): obj is UserStatus {
  return typeof obj.last_online === 'number';
}

function validateUserStatus(userStatuses: Record<string, any>): boolean {
  for (const userID in userStatuses) {
    if (!isUserStatus(userStatuses[userID])) {
      return false;
    }
  }
  return true;
}

/** Type guard for Drinks. Return true if an object is of Drinks type, and false otherwise.
 *
 * @param obj Object to check
 * @returns bool
 */
function isDrinks(obj: any): obj is Drinks {
  for (const key of Object.keys(obj)) {
    if (!Object.values(CONST.DRINKS.KEYS).includes(key as any)) {
      return false; // Unexpected key
    }

    if (typeof obj[key] !== 'number') {
      return false; // Value is not a number
    }
  }
  return true;
}

/** Input an object of supposed current drinking data and validate that the object is indeed of the DrinkingSessionList type. Return true if yes, and false otherwise.
 *
 * @param obj Object to validate.
 * @returns bool
 */
function isDrinkingSessionList(obj: any): obj is DrinkingSessionList {
  for (const sessionId in obj) {
    const session = obj[sessionId];

    if (
      typeof session.start_time !== 'number' ||
      typeof session.end_time !== 'number' ||
      !isDrinksList(session.drinks) ||
      typeof session.blackout !== 'boolean' ||
      typeof session.note !== 'string' ||
      (session.ongoing !== undefined &&
        typeof session.ongoing !== 'boolean' &&
        session.ongoing !== null) ||
      typeof session.type !== 'string'
    ) {
      return false;
    }
  }
  return true;
}

/** Enter a data object containing supposed drinking sessions, and validate that all objects (values) are indeed of the supposed type. If yes, return true, otherwise return false.
 *
 * @param userSessions Data to validate
 * @returns bool
 */
function validateUserDrinkingSessions(
  userSessions: Record<string, any>,
): boolean {
  for (const userID in userSessions) {
    if (!isDrinkingSessionList(userSessions[userID])) {
      return false;
    }
  }
  return true;
}

/** Check that an object is of type DrinksList. If yes, return true, otherwise return false.
 *
 * @param obj Object to check
 * @returns bool
 */
function isDrinksList(obj: any): obj is DrinksList {
  for (const timestamp of Object.keys(obj)) {
    if (isNaN(Number(timestamp))) {
      return false; // Key is not a valid timestamp (not a number)
    }

    if (!isDrinks(obj[timestamp])) {
      return false; // Value does not match the Drinks structure
    }
  }
  return true;
}

/** Type guard for DrinksList. Return true if an object is of Drinks type, and false otherwise.
 *
 * @param obj Object to check
 * @returns bool
 */
function isUnitsToColors(obj: any): obj is UnitsToColors {
  return typeof obj.yellow === 'number' && typeof obj.orange === 'number';
}

/** Using any object, validate that this object is of the Feedback type. If yes, return true, otherwise return false.
 *
 * @param obj Object to validate
 * @returns bool
 */
function isUserPreferences(obj: any): obj is Preferences {
  return (
    typeof obj.first_day_of_week === 'string' &&
    isUnitsToColors(obj.units_to_colors)
  );
}

/** Enter a data object containing supposed user preferences, and validate that all objects (values) are indeed of the supposed type. If yes, return true, otherwise return false.
 *
 * @param userPreferences Data to validate
 * @returns bool
 */
function validateUserPreferences(
  userPreferences: Record<string, any>,
): boolean {
  for (const userID in userPreferences) {
    if (!isUserPreferences(userPreferences[userID])) {
      return false;
    }
  }
  return true;
}

/** Using any object, validate that this object is of the UnconfirmedDays type. If yes, return true, otherwise return false.
 *
 * @param obj Object to validate
 * @returns bool
 */
function isUserUnconfirmedDays(obj: any): obj is UnconfirmedDays {
  for (const dayString of Object.keys(obj)) {
    if (typeof dayString !== 'string') {
      return false;
    }

    if (typeof obj[dayString] !== 'boolean') {
      return false;
    }
  }
  return true;
}

/** Enter a data object containing supposed user unconfirmed days, and validate that all objects (values) are indeed of the supposed type. If yes, return true, otherwise return false.
 *
 * @param userUnconfirmedDays Data to validate
 * @returns bool
 */
function validateUserUnconfirmedDays(
  userUnconfirmedDays: Record<string, any>,
): boolean {
  for (const userID in userUnconfirmedDays) {
    if (!isUserUnconfirmedDays(userUnconfirmedDays[userID])) {
      return false;
    }
  }
  return true;
}

/** Using any object, validate that this object is of the UnconfirmedData type. If yes, return true, otherwise return false.
 *
 * @param obj Object to validate
 * @returns bool
 */
function isUserData(obj: any): obj is UserProps {
  return typeof obj.role === 'string';
}

/** Enter a data object containing supposed user data, and validate that all objects (values) are indeed of the supposed type. If yes, return true, otherwise return false.
 *
 * @param userData Data to validate
 * @returns bool
 */
function validateUserData(userData: UserPropsList): boolean {
  for (const userID in userData) {
    if (!isUserData(userData[userID])) {
      return false;
    }
  }
  return true;
}

describe('mockDatabase functions', () => {
  it('should initialize an empty mock database', () => {
    const db = initializeEmptyMockDatabase();
    expect(db).toBeDefined();
    expect(db.config.app_settings.min_supported_version).toBe('0.0.1');
    expect(db.config.app_settings.min_user_creation_possible_version).toBe(
      '0.0.1',
    );
  });

  it('should create mock config', () => {
    const config = createMockConfig();
    expect(config.app_settings).not.toBe(null);
    expect(config.maintenance).not.toBe(null);
  });

  it('should create a mock app settings', () => {
    const app_settings = createMockAppSettings('0.0.2', '0.0.2');
    expect(app_settings.min_supported_version).toBe('0.0.2');
    expect(app_settings.min_user_creation_possible_version).toBe('0.0.2');
  });

  it('should create a mock maintenance object', () => {
    const maintenance = createMockMaintenance();
    expect(maintenance.maintenance_mode).toBe(false);
  });

  it('should create a mock feedback object', () => {
    const feedback = createMockFeedback();
    expect(feedback).toBeDefined();
    expect(feedback.text).toBe('Mock feedback');
  });

  it('should create a mock drinks object', () => {
    const drinks = createMockDrinksList({wine: 5});
    expect(drinks).toBeDefined();
    expect(Object.values(drinks)[0].wine).toBe(5);
  });

  it('should create a mock session', () => {
    const session = createMockSession(new Date());
    expect(session).toBeDefined();
    expect(session.start_time).toBeLessThan(session.end_time);
  });

  it('should create mock preferences', () => {
    const preferences = createMockPreferences();
    expect(preferences).toBeDefined();
    expect(['Monday', 'Sunday']).toContain(preferences.first_day_of_week);
  });

  it('should create mock unconfirmed days', () => {
    const unconfirmedDays = createMockUnconfirmedDays();
    expect(unconfirmedDays).toBeDefined();
    expect(Object.keys(unconfirmedDays).length).toBeGreaterThanOrEqual(1);
  });

  it('should create mock user data', () => {
    const userData = createMockUserData('mock-user-id');
    expect(userData).toBeDefined();
    expect(userData.role).toBe('mock-user');
  });

  it('should create a mock database', () => {
    const db = createMockDatabase();
    expect(db).toBeDefined();
    expect(Object.keys(db.feedback).length).toBe(5);
  });
});

describe('mockDatabase data structure', () => {
  const db: DatabaseProps = initializeEmptyMockDatabase();

  it('should have config data', () => {
    expect(validateConfig(db.config)).toBe(true);
  });

  it('should have feedback data', () => {
    expect(validateFeedback(db.feedback)).toBe(true);
  });

  it('should have user status', () => {
    expect(validateUserStatus(db.user_status)).toBe(true);
  });

  it('should have user drinking session data', () => {
    expect(validateUserDrinkingSessions(db.user_drinking_sessions)).toBe(true);
  });

  it('should have user preferences data', () => {
    expect(validateUserPreferences(db.user_preferences)).toBe(true);
  });

  it('should have user unconfirmed days data', () => {
    expect(validateUserUnconfirmedDays(db.user_unconfirmed_days)).toBe(true);
  });

  it('should have user data', () => {
    expect(validateUserData(db.users)).toBe(true);
  });
});
