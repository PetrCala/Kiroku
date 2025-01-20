import fs from 'fs';
import {rand} from '@ngneat/falso';
import type {
  AppSettings,
  Config,
  DatabaseProps,
  DrinkingSession,
  Feedback,
  FriendRequestList,
  FriendRequestStatus,
  Maintenance,
  NicknameToId,
  Preferences,
  Profile,
  UnconfirmedDays,
  Drinks,
  UnitsToColors,
  UserData,
  UserStatus,
  DrinksList,
  DrinksToUnits,
  DrinkingSessionList,
} from '@src/types/onyx';
import {getRandomChoice, getRandomInt} from '@libs/Choice';
import {
  formatDate,
  getLastStartedSession,
  getLastStartedSessionId,
  getRandomDrinksList,
  getZeroDrinksList,
} from '@libs/DataHandling';
import {cleanStringForFirebaseKey} from '@libs/StringUtilsKiroku';
import CONST from '@src/CONST';
import {addDays, subDays} from 'date-fns';
import DateUtils from '@libs/DateUtils';
import {randDrinkingSessionList} from './collections/drinkingSessions';
import {randUserIDs} from './collections/userAccount';

/**
 * Creates a mock app settings object.
 * @returns The mock app settings object.
 */
function createMockAppSettings(
  minSupportedVersion = '0.0.1',
  minUserCreationPossibleVersion = '0.0.1',
): AppSettings {
  return {
    min_supported_version: minSupportedVersion,
    min_user_creation_possible_version: minUserCreationPossibleVersion,
  };
}

/**
 * Creates a mock maintenance object.
 * @returns The mock maintenance object.
 */
function createMockMaintenance(
  maintenanceModeOn = false,
  startTime = 0,
  endTime = 0,
): Maintenance {
  return {
    maintenance_mode: maintenanceModeOn,
    start_time: startTime,
    end_time: endTime,
  };
}

/** Initialize an empty database object to be
 * used for easier populating
 *
 * @returns Databse type object
 */
function initializeEmptyMockDatabase(): DatabaseProps {
  return {
    account_creations: {},
    bugs: {},
    config: {
      app_settings: createMockAppSettings(),
      maintenance: createMockMaintenance(),
    },
    feedback: {},
    nickname_to_id: {},
    reasons_for_leaving: {},
    user_status: {},
    user_drinking_sessions: {},
    user_preferences: {},
    user_session_placeholder: {},
    user_unconfirmed_days: {},
    users: {},
  };
}

/** Create a mock configuration data record
 *
 * @param min_supported_version Minimum supported
 * version of the app. Defaults to 0.0.1.
 * @returns Mock configuration data record
 */
function createMockConfig(): Config {
  const mockConfig: Config = {
    app_settings: createMockAppSettings(),
    maintenance: createMockMaintenance(),
  };
  return mockConfig;
}

/** Create a mock feedback object
 *
 * @returns Feedback object.
 */
function createMockFeedback(): Feedback {
  return {
    submit_time: Date.now(),
    text: 'Mock feedback',
    user_id: 'mock-user-id',
  };
}

function createMockUserStatus(
  drinkingSessions: DrinkingSessionList,
): UserStatus {
  const mockUserStatus: UserStatus = {
    last_online: Date.now(),
  };
  const latestSessionId = getLastStartedSessionId(drinkingSessions);
  const latestSession = getLastStartedSession(drinkingSessions);

  if (latestSessionId && latestSession) {
    mockUserStatus.latest_session_id = latestSessionId;
    mockUserStatus.latest_session = latestSession;
  }
  return mockUserStatus;
}

/** Create a mock nicknames to user IDs data object.
 *
 * @returns The mock object.
 */
function createMockNicknameToId(userID: string): NicknameToId {
  const returnObject: NicknameToId = {
    [userID]: 'mock nickname',
  };
  return returnObject;
}

/** Generate a mock object of drinks
 *
 * @usage const onlyWine = generateMockDrinksList({ wine: 5 });
 */
function createMockDrinksList(drinks: Drinks = {}): DrinksList {
  if (Object.keys(drinks).length === 0) {
    // If drinks are unspecified
    return getRandomDrinksList();
  }
  const timestampNow = new Date().getTime();
  return {
    [timestampNow]: drinks,
  };
}

/**
 * Generates a DrinkingSession for a specified offset relative to a given date.
 *
 * @param baseDate Date around which sessions are created.
 * @param shouldOffetDays Whether or not the date should be randomly offset
 * @param drinks Drinks consumed during the session
 * @param ongoing Whether the session is ongoing or not
 * @returns A DrinkingSession object.
 */
function createMockSession(
  baseDate: Date,
  shouldOffetDays?: boolean,
  drinks?: DrinksList,
  ongoing?: boolean,
): DrinkingSession {
  const sessionDrinks: DrinksList = drinks ?? getZeroDrinksList();
  let sessionDate = new Date(baseDate);

  if (shouldOffetDays) {
    // Randomize between -7 and 7 days
    const daysOffset = Math.floor(Math.random() * 15) - 7;
    sessionDate =
      daysOffset > 0
        ? addDays(sessionDate, daysOffset)
        : subDays(sessionDate, daysOffset);
  }

  const newSession: DrinkingSession = {
    start_time: sessionDate.getTime(),
    end_time: sessionDate.getTime() + 2 * 60 * 60 * 1000, // +2 hours
    blackout: false,
    note: '',
    drinks: sessionDrinks,
    type: getRandomChoice(Object.values(CONST.SESSION.TYPES)),
    timezone: DateUtils.getCurrentTimezone().selected,
  };
  if (ongoing) {
    newSession.ongoing = true;
  }

  return newSession;
}

/** Create an object of mock preferences for a user.
 *
 * @returns User preferences type object
 */
function createMockPreferences(): Preferences {
  const mockUnitsToColors: UnitsToColors = {
    yellow: getRandomInt(3, 6),
    orange: getRandomInt(7, 10),
  };
  const mockDrinksToUnitsData: DrinksToUnits = {
    small_beer: 0.5,
    beer: 1,
    cocktail: 1.5,
    other: 1,
    strong_shot: 1,
    weak_shot: 0.5,
    wine: 1,
  };
  const mockPreferences: Preferences = {
    first_day_of_week: getRandomChoice(['Monday', 'Sunday']),
    units_to_colors: mockUnitsToColors,
    drinks_to_units: mockDrinksToUnitsData,
    theme: getRandomChoice([CONST.THEME.DARK, CONST.THEME.LIGHT]),
  };
  return mockPreferences;
}

/** Create and return an unconfirmed days type object.
 *
 * @returns Unconfirmed days object
 */
function createMockUnconfirmedDays(): UnconfirmedDays {
  const data: UnconfirmedDays = {};
  const today = new Date();

  // Randomly choose the number of entries to generate
  const numberOfEntries = getRandomInt(1, 10);

  for (let i = 0; i < numberOfEntries; i++) {
    // Get a random date between today and 365 days ago (1 year ago).
    const randomPastDate = new Date(
      today.getTime() - getRandomInt(0, 365) * 24 * 60 * 60 * 1000,
    );
    const dateKey = formatDate(randomPastDate);
    data[dateKey] = true;
  }

  return data;
}

/** Create and return mock friend request data. Is created at random.
 *  (possibly improve in the future)
 *
 * @param userID ID of the mock user
 * @returns Mock FriendRequest type data.
 */
function createMockFriendRequests(userID: string): FriendRequestList {
  const mockRequestData: FriendRequestList = {};
  const statuses: FriendRequestStatus[] = Object.values(
    CONST.FRIEND_REQUEST_STATUS,
  );
  const mockUserIDs = randUserIDs({length: 10});
  for (const mockId of mockUserIDs) {
    if (mockId !== userID) {
      const randomIndex = Math.floor(Math.random() * statuses.length);
      const mockStatus = statuses[randomIndex];
      mockRequestData[mockId] = mockStatus;
    }
  }
  return mockRequestData;
}

/** Create and return a mock user data object
 * @param userID ID of the mock user
 * @param index Index of the mock user
 * @param noFriends If set to true, no friends or friend requests will be created.
 * @returns Mock user data
 */
function createMockUserData(userID: string, noFriends = false): UserData {
  const mockProfile: Profile = {
    display_name: 'mock-user',
    photo_url: '',
  };
  const mockUserData: UserData = {
    profile: mockProfile,
    role: 'mock-user',
  };
  if (!noFriends) {
    // mockUserData['friends'] = // TODO
    mockUserData.friend_requests = createMockFriendRequests(userID);
  }
  return mockUserData;
}

/** Create and return an object that will mock
 * the firebase database. This object has the
 * type Database.
 *
 * @param noFriends If set to true, no friends or friend requests will be created.
 * @returns A mock object of the firebase database
 */
function createMockDatabase(noFriends = false): DatabaseProps {
  const db = initializeEmptyMockDatabase();
  // Configuration
  db.config = createMockConfig();

  // Data that varies across users
  const mockUserIDs = randUserIDs({length: 150});

  mockUserIDs.forEach(userID => {
    const userDrinkingSessions = randDrinkingSessionList({
      length: rand([0, 5, 10, 100, 500]),
      shouldIncludeOngoing: true,
    });
    const userData = createMockUserData(userID, noFriends);
    const nickname = userData.profile.display_name;
    const nickname_key = cleanStringForFirebaseKey(nickname);

    db.feedback[userID] = createMockFeedback();
    db.user_drinking_sessions[userID] = userDrinkingSessions;
    db.user_status[userID] = createMockUserStatus(userDrinkingSessions);
    db.user_preferences[userID] = createMockPreferences();
    db.user_unconfirmed_days[userID] = createMockUnconfirmedDays();
    db.users[userID] = userData;
    db.nickname_to_id[nickname_key] = createMockNicknameToId(userID);
  });

  return db;
}

/**
 * Export the mock database as a JSON file at the current folder location.
 *
 * @returns The path of the exported JSON file.
 */
function exportMockDatabase(): string {
  const mockDatabase = createMockDatabase();
  const filePath = './mockDatabase.json';
  fs.writeFileSync(filePath, JSON.stringify(mockDatabase));
  return filePath;
}

export {
  createMockAppSettings,
  createMockMaintenance,
  initializeEmptyMockDatabase,
  createMockConfig,
  createMockFeedback,
  createMockUserStatus,
  createMockNicknameToId,
  createMockDrinksList,
  createMockSession,
  createMockPreferences,
  createMockUnconfirmedDays,
  createMockFriendRequests,
  createMockUserData,
  createMockDatabase,
  exportMockDatabase,
};
