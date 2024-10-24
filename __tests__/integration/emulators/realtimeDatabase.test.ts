// !! Run using npm test - to run using bun test, resolve first issue with Config -> mock react-native-config

require('dotenv').config(); // Use .env variables in this file - CONFIG does not work here
import {ref, get, set} from 'firebase/database';
import type {FirebaseApp} from 'firebase/app';
import {
  createMockConfig,
  createMockSession,
  createMockUserStatus,
} from '../../../src/database/MockDatabase';
import {isConnectedToDatabaseEmulator} from '@src/libs/Firebase/FirebaseUtils';
import type {
  FriendRequestList,
  Profile,
  Drinks,
  DrinkingSession,
} from '@src/types/onyx';
import type {Database} from 'firebase/database';
import {
  saveDrinkingSessionData,
  savePlaceholderSessionData,
} from '@database/drinkingSessions';

import {MOCK_USER_IDS} from '../../utils/testsStatic';
import {readDataOnce} from '@database/baseFunctions';
import {setupGlobalMocks} from '../../utils/testUtils';
import DatabaseEmulator from '../../emulators/database';
import {
  changeDisplayName,
  deleteUserData,
  getDefaultPreferences,
  getDefaultUserData,
  getDefaultUserStatus,
  pushNewUserInfo,
} from '@database/users';
import {cleanStringForFirebaseKey} from '@libs/StringUtilsKiroku';
import {
  acceptFriendRequest,
  deleteFriendRequest,
  isFriend,
  sendFriendRequest,
  unfriend,
} from '@database/friends';
import DBPATHS from '@database/DBPATHS';
import CONST from '@src/CONST';
import DSUtils from '@libs/DrinkingSessionUtils';
import {describeWithEmulator} from '../../emulators/utils';

const testUserID: string = MOCK_USER_IDS[0];
const testUserDisplayName = 'mock-user';
const testUserID2: string = MOCK_USER_IDS[1];

const mockSessionKey = `${testUserID}-mock-session-999`;
const mockSessionDrinks: Drinks = {
  beer: 2,
  wine: 1,
  other: 3,
};
const mockDrinkingSession = createMockSession(
  new Date(),
  undefined,
  mockSessionDrinks,
  undefined,
);
const mockUserStatus = createMockUserStatus(
  mockSessionKey,
  mockDrinkingSession,
);

describeWithEmulator(
  'Test connecting to the realtime database emulator',
  () => {
    let testApp: FirebaseApp;
    let db: Database;
    setupGlobalMocks();

    beforeAll(async () => {
      ({testApp, db} = DatabaseEmulator.setup());
    });

    // Set up the database before each test
    beforeEach(async () => {
      await DatabaseEmulator.fillWithMockData(db);
    });

    // Write null to clear the database.
    afterEach(async () => {
      await set(ref(db), null);
    });

    afterAll(async () => {
      await DatabaseEmulator.teardown(testApp, db);
    });

    it('should connect to the emulator realtime database', async () => {
      expect(db).not.toBeNull();
      expect(isConnectedToDatabaseEmulator(db)).toBe(true);
    });
  },
);

describeWithEmulator('Test realtime database emulator', () => {
  let testApp: FirebaseApp;
  let db: Database;
  setupGlobalMocks();

  beforeAll(async () => {
    ({testApp, db} = DatabaseEmulator.setup());
  });

  beforeEach(async () => {
    await DatabaseEmulator.fillWithMockData(db);
  });

  afterEach(async () => {
    await set(ref(db), null);
  });

  afterAll(async () => {
    await DatabaseEmulator.teardown(testApp, db);
  });

  it('should write non-empty mock data', async () => {
    async function getDatabaseRef() {
      const tempRef = ref(db, 'config');
      const snapshot = await get(tempRef); // One-off fetch
      return snapshot;
    }
    const data = await getDatabaseRef();
    expect(data.exists()).toBe(true);
    expect(data.val()).not.toBeNull();
  });
});

describeWithEmulator('Test config functionality', () => {
  let testApp: FirebaseApp;
  let db: Database;
  setupGlobalMocks();

  beforeAll(async () => {
    ({testApp, db} = DatabaseEmulator.setup());
  });

  beforeEach(async () => {
    await DatabaseEmulator.fillWithMockData(db);
  });

  afterEach(async () => {
    await set(ref(db), null);
  });

  afterAll(async () => {
    await DatabaseEmulator.teardown(testApp, db);
  });

  it('should correctly read the config', async () => {
    const expectedConfig = createMockConfig();
    const config = await readDataOnce(db, DBPATHS.CONFIG);
    expect(config).not.toBeNull();
    expect(config).toEqual(expectedConfig);
  });
});

describeWithEmulator('Test drinking session functionality', () => {
  let testApp: FirebaseApp;
  let db: Database;
  setupGlobalMocks();

  beforeAll(async () => {
    ({testApp, db} = DatabaseEmulator.setup());
  });

  beforeEach(async () => {
    await DatabaseEmulator.fillWithMockData(db);
  });

  afterEach(async () => {
    await set(ref(db), null);
  });

  afterAll(async () => {
    await DatabaseEmulator.teardown(testApp, db);
  });

  it('should correctly save user status info', async () => {
    const dbRef = DBPATHS.USER_STATUS_USER_ID.getRoute(testUserID);
    await set(ref(db, dbRef), mockUserStatus);
    const newSessionInfo = await readDataOnce(db, dbRef);
    expect(newSessionInfo).toEqual(newSessionInfo);
  });

  it('should save drinking session data', async () => {
    await saveDrinkingSessionData(
      db,
      testUserID,
      mockDrinkingSession,
      mockSessionKey,
    );

    const userSessionRef =
      DBPATHS.USER_DRINKING_SESSIONS_USER_ID_SESSION_ID.getRoute(
        testUserID,
        mockSessionKey,
      );
    const userSession = await readDataOnce(db, userSessionRef);

    expect(userSession).not.toBeNull();
    expect(userSession).toMatchObject(mockDrinkingSession);
  });

  it('should save a placeholder session', async () => {
    const mockPlaceholderSession: DrinkingSession = DSUtils.getEmptySession(
      CONST.SESSION_TYPES.EDIT,
      true,
      false,
    );

    await savePlaceholderSessionData(db, testUserID, mockPlaceholderSession);
    const placeholderSessionRef =
      DBPATHS.USER_SESSION_PLACEHOLDER_USER_ID.getRoute(testUserID);
    const placeholderSession = await readDataOnce(db, placeholderSessionRef);

    expect(placeholderSession).toMatchObject(mockPlaceholderSession);
  });
});

describeWithEmulator('Test pushing new user info into the database', () => {
  let testApp: FirebaseApp;
  let db: Database;
  const newUserDisplayName = 'mock-user-6';
  const newUserProfileData: Profile = {
    display_name: newUserDisplayName,
    photo_url: '',
  };
  const newUserID = 'mock-user-6'; // This user should not be created in the mock database
  setupGlobalMocks();

  beforeAll(async () => {
    ({testApp, db} = DatabaseEmulator.setup());
  });

  beforeEach(async () => {
    await DatabaseEmulator.fillWithMockData(db);

    const userStatusList = await readDataOnce(db, DBPATHS.USER_STATUS); // Arbitrary node with all user ids in top level
    const userKeys = Object.keys(userStatusList);
    expect(userKeys).not.toContain(newUserID); // Check that the user does not exist in the mock database

    await pushNewUserInfo(db, newUserID, newUserProfileData);
  });

  afterEach(async () => {
    await set(ref(db), null);
  });

  afterAll(async () => {
    await DatabaseEmulator.teardown(testApp, db);
  });

  it('pushes the account creation data into the database', async () => {
    const deviceId = 'mock-device-id';
    const dbRef = DBPATHS.ACCOUNT_CREATIONS_DEVICE_ID_USER_ID.getRoute(
      deviceId,
      newUserID,
    );
    const dbCreationData = await readDataOnce(db, dbRef);
    expect(dbCreationData).toBeCloseTo(Date.now(), -2); // Within 100ms
  });

  it('pushes the nickname to id data into the database', async () => {
    const expectedNickname = newUserDisplayName;
    const nicknameKey = cleanStringForFirebaseKey(
      newUserProfileData.display_name,
    );
    const dbRef = DBPATHS.NICKNAME_TO_ID_NICKNAME_KEY_USER_ID.getRoute(
      nicknameKey,
      newUserID,
    );
    const dbNickname: string = await readDataOnce(db, dbRef);
    expect(dbNickname).toEqual(expectedNickname);
  });

  it('pushes the user preferences into the database', async () => {
    const expectedPreferences = getDefaultPreferences();
    const dbRef = DBPATHS.USER_PREFERENCES_USER_ID.getRoute(newUserID);
    const dbPreferencesData = await readDataOnce(db, dbRef);
    expect(dbPreferencesData).toMatchObject(expectedPreferences);
  });

  it('pushes the user data into the database', async () => {
    const expectedData = getDefaultUserData(newUserProfileData);
    const dbRef = DBPATHS.USERS_USER_ID.getRoute(newUserID);
    const dbUserData = await readDataOnce(db, dbRef);
    expect(dbUserData).toMatchObject(expectedData);
  });

  it('pushes the user status into the database', async () => {
    const expectedStatus = getDefaultUserStatus();
    const dbRef = DBPATHS.USER_STATUS_USER_ID.getRoute(newUserID);
    const dbStatusData = await readDataOnce(db, dbRef);
    expect(dbStatusData).toMatchObject({
      ...expectedStatus,
      last_online: expect.any(Number),
    });
    expect(dbStatusData.last_online).toBeCloseTo(
      expectedStatus.last_online,
      -2,
    ); // Within 100ms
  });
});

describeWithEmulator('Test deleting data from the database', () => {
  let testApp: FirebaseApp;
  let db: Database;
  setupGlobalMocks();

  beforeAll(async () => {
    ({testApp, db} = DatabaseEmulator.setup());
  });

  beforeEach(async () => {
    await DatabaseEmulator.fillWithMockData(db);
    await deleteUserData(
      db,
      testUserID,
      testUserDisplayName,
      undefined,
      undefined,
    ); // TODO: Add friend requests, friends
  });

  afterEach(async () => {
    await set(ref(db), null);
  });

  afterAll(async () => {
    await DatabaseEmulator.teardown(testApp, db);
  });

  it('deletes the user nickname ID data from the database', async () => {
    const nicknameKey = cleanStringForFirebaseKey(testUserDisplayName);
    const dbRef = DBPATHS.NICKNAME_TO_ID_NICKNAME_KEY_USER_ID.getRoute(
      nicknameKey,
      testUserID,
    );
    const dbNickname = await readDataOnce(db, dbRef);
    expect(dbNickname).toBeNull();
  });

  it('deletes the user data from the database', async () => {
    const dbRef = DBPATHS.USERS_USER_ID.getRoute(testUserID);
    const dbData = await readDataOnce(db, dbRef);
    expect(dbData).toBeNull();
  });

  it('deletes the user status data from the database', async () => {
    const dbRef = DBPATHS.USER_STATUS_USER_ID.getRoute(testUserID);
    const dbSessionData = await readDataOnce(db, dbRef);
    expect(dbSessionData).toBeNull();
  });

  it('deletes the user preferences from the database', async () => {
    const dbRef = DBPATHS.USER_PREFERENCES_USER_ID.getRoute(testUserID);
    const dbPreferencesData = await readDataOnce(db, dbRef);
    expect(dbPreferencesData).toBeNull();
  });

  it('deletes the user drinking sessions from the database', async () => {
    const dbRef = DBPATHS.USER_DRINKING_SESSIONS_USER_ID.getRoute(testUserID);
    const dbSessionsData = await readDataOnce(db, dbRef);
    expect(dbSessionsData).toBeNull();
  });

  it('deletes the user unconfirmed days from the database', async () => {
    const dbRef = DBPATHS.USER_UNCONFIRMED_DAYS_USER_ID.getRoute(testUserID);
    const dbUnconfirmedDays = await readDataOnce(db, dbRef);
    expect(dbUnconfirmedDays).toBeNull();
  });
});

describeWithEmulator('Test friend request functionality', () => {
  let testApp: FirebaseApp;
  let db: Database;
  setupGlobalMocks();

  beforeAll(async () => {
    ({testApp, db} = DatabaseEmulator.setup());
  });

  beforeEach(async () => {
    await DatabaseEmulator.fillWithMockData(db, true); // No friends
    await deleteUserData(
      db,
      testUserID,
      testUserDisplayName,
      undefined,
      undefined,
    );
    const user1FriendsRef = DBPATHS.USERS_USER_ID_FRIENDS.getRoute(testUserID);
    const friendRequestsRef =
      DBPATHS.USERS_USER_ID_FRIEND_REQUESTS.getRoute(testUserID);
    const friends = await readDataOnce(db, user1FriendsRef);
    const friendRequests = await readDataOnce(db, friendRequestsRef);
    expect(friends).toBeNull();
    expect(friendRequests).toBeNull();
  });

  afterEach(async () => {
    await set(ref(db), null);
  });

  afterAll(async () => {
    await DatabaseEmulator.teardown(testApp, db);
  });

  it('should correctly determine friends', async () => {
    const friend1Ref = DBPATHS.USERS_USER_ID_FRIENDS_FRIEND_ID.getRoute(
      testUserID,
      testUserID2,
    );
    const friend2Ref = DBPATHS.USERS_USER_ID_FRIENDS_FRIEND_ID.getRoute(
      testUserID2,
      testUserID,
    );
    await set(ref(db, friend1Ref), true);
    await set(ref(db, friend2Ref), true);
    const usersAreFriends = await isFriend(db, testUserID, testUserID2);
    expect(usersAreFriends).toBe(true);
  });

  it('should send a friend request', async () => {
    const user1Ref = DBPATHS.USERS_USER_ID_FRIEND_REQUESTS.getRoute(testUserID);
    const user2Ref =
      DBPATHS.USERS_USER_ID_FRIEND_REQUESTS.getRoute(testUserID2);
    const expectedRequestsUser1: FriendRequestList = {
      [testUserID2]: CONST.FRIEND_REQUEST_STATUS.SENT,
    };
    const expectedRequestsUser2: FriendRequestList = {
      [testUserID]: CONST.FRIEND_REQUEST_STATUS.RECEIVED,
    };
    await sendFriendRequest(db, testUserID, testUserID2);
    const user1FriendRequests = await readDataOnce(db, user1Ref);
    const user2FriendRequests = await readDataOnce(db, user2Ref);
    expect(user1FriendRequests).toMatchObject(expectedRequestsUser1);
    expect(user2FriendRequests).toMatchObject(expectedRequestsUser2);
  });

  it('should delete a friend request', async () => {
    const user1Ref = DBPATHS.USERS_USER_ID_FRIEND_REQUESTS_REQUEST_ID.getRoute(
      testUserID,
      testUserID2,
    );
    const user2Ref = DBPATHS.USERS_USER_ID_FRIEND_REQUESTS_REQUEST_ID.getRoute(
      testUserID2,
      testUserID,
    );
    await set(ref(db, user1Ref), CONST.FRIEND_REQUEST_STATUS.SENT);
    await set(ref(db, user2Ref), CONST.FRIEND_REQUEST_STATUS.RECEIVED);
    await deleteFriendRequest(db, testUserID, testUserID2);
    const user1FriendRequestsRef =
      DBPATHS.USERS_USER_ID_FRIEND_REQUESTS.getRoute(testUserID);
    const user2FriendRequestsRef =
      DBPATHS.USERS_USER_ID_FRIEND_REQUESTS.getRoute(testUserID2);
    const user1FriendRequests = await readDataOnce(db, user1FriendRequestsRef);
    const user2FriendRequests = await readDataOnce(db, user2FriendRequestsRef);
    expect(user1FriendRequests).toBeNull();
    expect(user2FriendRequests).toBeNull();
  });

  it('should accept a friend request', async () => {
    const user1Ref = DBPATHS.USERS_USER_ID_FRIEND_REQUESTS_REQUEST_ID.getRoute(
      testUserID,
      testUserID2,
    );
    const user2Ref = DBPATHS.USERS_USER_ID_FRIEND_REQUESTS_REQUEST_ID.getRoute(
      testUserID2,
      testUserID,
    );
    const user1FriendRequestsRef =
      DBPATHS.USERS_USER_ID_FRIEND_REQUESTS.getRoute(testUserID);
    const user2FriendRequestsRef =
      DBPATHS.USERS_USER_ID_FRIEND_REQUESTS.getRoute(testUserID2);
    const user1FriendsRef = DBPATHS.USERS_USER_ID_FRIENDS.getRoute(testUserID);
    const user2FriendsRef = DBPATHS.USERS_USER_ID_FRIENDS.getRoute(testUserID2);

    await set(ref(db, user1Ref), CONST.FRIEND_REQUEST_STATUS.SENT);
    await set(ref(db, user2Ref), CONST.FRIEND_REQUEST_STATUS.RECEIVED);
    await acceptFriendRequest(db, testUserID, testUserID2);
    const user1FriendRequests = await readDataOnce(db, user1FriendRequestsRef);
    const user2FriendRequests = await readDataOnce(db, user2FriendRequestsRef);
    expect(user1FriendRequests).toBeNull();
    expect(user2FriendRequests).toBeNull();

    const user1Friends = await readDataOnce(db, user1FriendsRef);
    const user2Friends = await readDataOnce(db, user2FriendsRef);
    expect(user1Friends).toMatchObject({[testUserID2]: true});
    expect(user2Friends).toMatchObject({[testUserID]: true});
  });

  it('should unfriend a user', async () => {
    const user1Ref = DBPATHS.USERS_USER_ID_FRIENDS_FRIEND_ID.getRoute(
      testUserID,
      testUserID2,
    );
    const user2Ref = DBPATHS.USERS_USER_ID_FRIENDS_FRIEND_ID.getRoute(
      testUserID2,
      testUserID,
    );
    const user1FriendsRef = DBPATHS.USERS_USER_ID_FRIENDS.getRoute(testUserID);
    const user2FriendsRef = DBPATHS.USERS_USER_ID_FRIENDS.getRoute(testUserID2);
    await set(ref(db, user1Ref), true);
    await set(ref(db, user2Ref), true);
    await unfriend(db, testUserID, testUserID2);
    const user1Friends = await readDataOnce(db, user1FriendsRef);
    const user2Friends = await readDataOnce(db, user2FriendsRef);
    expect(user1Friends).toBeNull();
    expect(user2Friends).toBeNull();

    const usersAreFriends = await isFriend(db, testUserID, testUserID2); // Extra check
    expect(usersAreFriends).toBe(false);
  });
});

// describeWithEmulator('Test user data modifications', () => {
//   let testApp: FirebaseApp;
//   let db: Database;
//   let auth: Auth;
//   setupGlobalMocks();

//   beforeAll(async () => {
//     ({testApp, auth} = setupAuthTestEnv());
//     ({testApp, db} = DatabaseEmulator.setup()); // Overrides the testApp
//   });

//   beforeEach(async () => {
//     await DatabaseEmulator.fillWithMockData(db, true); // No friends
//     await DatabaseEmulator.create(auth);
//   });

//   afterEach(async () => {
//     await set(ref(db), null);
//   });

//   afterAll(async () => {
//     await DatabaseEmulator.teardown(testApp, db);
//   });

//   it("should correctly modify a user's display name", async () => {
//     const displayNameRef =
//       DBPATHS.USERS_USER_ID_PROFILE_DISPLAY_NAME.getRoute(testUserID);
//     const displayNameToUpdate = 'test-new-display-name';

//     await changeDisplayName(db, auth.currentUser, displayNameToUpdate);

//     const newDisplayName = await readDataOnce(db, displayNameRef);
//     expect(newDisplayName).toEqual(displayNameToUpdate);

//     const newNicknameKey = cleanStringForFirebaseKey(displayNameToUpdate);
//     const nicknameRef = DBPATHS.NICKNAME_TO_ID_NICKNAME_KEY_USER_ID.getRoute(
//       newNicknameKey,
//       testUserID,
//     );

//     const newNicknameToId = await readDataOnce(db, nicknameRef);
//     expect(newNicknameToId).toEqual(displayNameToUpdate);
//   });
// });
