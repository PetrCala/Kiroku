import fs from 'fs';
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
  UserProps,
  UserStatus,
  DrinksList,
  DrinkingSessionList,
  DrinkingSessionId,
  DrinksToUnits,
} from '@src/types/onyx';
import {getRandomChoice, getRandomInt} from '@libs/Choice';
import {
  formatDate,
  getRandomDrinksList,
  getZeroDrinksList,
} from '@libs/DataHandling';
import {cleanStringForFirebaseKey} from '@libs/StringUtilsKiroku';
import CONST from '@src/CONST';
import {UserID} from '@src/types/onyx/OnyxCommon';

function getMockSessionIDs(): Array<string> {
  return ['mock-session-1', 'mock-session-2', 'mock-session-3'];
}

function getMockUserIDs(): Array<UserID> {
  return [
    'mock-user-1',
    'mock-user-2',
    'mock-user-3',
    'mock-user-4',
    'mock-user-5',
  ];
}

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
    config: {
      app_settings: createMockAppSettings(),
      maintenance: createMockMaintenance(),
    },
    feedback: {},
    nickname_to_id: {},
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
  latest_session_id?: string,
  latest_session?: DrinkingSession,
): UserStatus {
  const mockUserStatus: UserStatus = {
    last_online: Date.now(),
  };
  if (latest_session_id && latest_session) {
    mockUserStatus.latest_session_id = latest_session_id;
    mockUserStatus.latest_session = latest_session;
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
 * @param offsetDays Number of days to offset from baseDate. If not provided, a random offset between -7 and 7 days is used.
 * @param drinks Drinks consumed during the session
 * @param ongoing Whether the session is ongoing or not
 * @returns A DrinkingSession object.
 */
function createMockSession(
  baseDate: Date,
  offsetDays?: number,
  drinks?: DrinksList,
  ongoing?: boolean,
): DrinkingSession {
  if (!drinks) {
    drinks = getZeroDrinksList();
  }
  const sessionDate = new Date(baseDate);

  // If offsetDays is not provided, randomize between -7 and 7 days.
  const daysOffset =
    offsetDays !== undefined ? offsetDays : Math.floor(Math.random() * 15) - 7;

  sessionDate.setDate(sessionDate.getDate() + daysOffset);

  const startHour = 3; // you can randomize this or make it configurable

  sessionDate.setHours(startHour, 0, 0, 0);

  const newSession: DrinkingSession = {
    start_time: sessionDate.getTime(),
    end_time: sessionDate.getTime() + 2 * 60 * 60 * 1000, // +2 hours
    blackout: false,
    note: '',
    drinks: drinks,
    type: getRandomChoice(Object.values(CONST.SESSION_TYPES)),
    // timezone: DateUtils.getCurrentTimezone(),
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
  const mockUserIDs = getMockUserIDs();
  for (const mockId of mockUserIDs) {
    if (mockId === userID) {
      continue; // Skip self
    }
    const randomIndex = Math.floor(Math.random() * statuses.length);
    const mockStatus = statuses[randomIndex];
    mockRequestData[mockId] = mockStatus;
  }
  return mockRequestData;
}

/** Create and return a mock user data object
 * @param userID ID of the mock user
 * @param index Index of the mock user
 * @param noFriends If set to true, no friends or friend requests will be created.
 * @returns Mock user data
 */
function createMockUserData(userID: string, noFriends = false): UserProps {
  const mockProfile: Profile = {
    display_name: 'mock-user',
    photo_url: '',
  };
  const mockUserData: UserProps = {
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
  const mockUserIDs = getMockUserIDs();
  const mockSessionIDs = getMockSessionIDs();

  mockUserIDs.forEach((userID, index) => {
    // Feedback
    db.feedback[userID] = createMockFeedback();

    // Drinking sessions
    const mockSessionData: DrinkingSessionList = {};
    let latestSessionId = '';
    mockSessionIDs.forEach(sessionId => {
      const fullSessionId: DrinkingSessionId = `${userID}-${sessionId}`;
      const mockSession = createMockSession(new Date());
      mockSessionData[fullSessionId] = mockSession;
      latestSessionId = fullSessionId;
    });
    mockSessionData[latestSessionId].ongoing = true;
    db.user_drinking_sessions[userID] = mockSessionData;

    // User status
    db.user_status[userID] = createMockUserStatus(
      latestSessionId,
      mockSessionData[latestSessionId],
    );

    // User preferences
    db.user_preferences[userID] = createMockPreferences();

    // User unconfirmed data
    db.user_unconfirmed_days[userID] = createMockUnconfirmedDays();

    // User data
    db.users[userID] = createMockUserData(userID, noFriends);

    // Nicknames to user ids
    const nickname = db.users[userID].profile.display_name;
    const nickname_key = cleanStringForFirebaseKey(nickname);
    db.nickname_to_id[nickname_key] = createMockNicknameToId(userID);
  });

  return db;
}

/**
 * Export the mock database as a JSON file at the current folder location.
 *
 * @returns The path of the exported JSON file.
 */
function exportMockDatabase(verbose = false): string {
  const mockDatabase = createMockDatabase();
  const filePath = './mockDatabase.json';
  fs.writeFileSync(filePath, JSON.stringify(mockDatabase));
  if (verbose) {
    console.log('Mock database exported to: ' + filePath);
  }
  return filePath;
}

export {
  getMockSessionIDs,
  getMockUserIDs,
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
