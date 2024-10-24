// !! Run using npm test - to run using bun test, resolve first issue with Config -> mock react-native-config

require('dotenv').config(); // Use .env variables in this file - CONFIG does not work here
import type {RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {describeWithEmulator, makeFriends} from '../../emulators/utils';
import FBRules from '../../emulators/fbRules';
import type {Feedback} from '@src/types/onyx';
import {setupGlobalMocks} from '../../utils/testUtils';
import {
  createMockSession,
  createMockUserData,
  createMockUserStatus,
} from '../../../src/database/MockDatabase';
import {getDefaultPreferences} from '@database/users';
import {
  SAMPLE_UNITS_TO_COLORS,
  SAMPLE_DRINKS_TO_UNITS,
} from '../../utils/testsStatic';
import CONST from '../../../src/CONST';
import DBPATHS from '@database/DBPATHS';

const testFeedbackId = 'testFeedbackId';
const testFeedback: Feedback = {
  submit_time: 0,
  text: 'test',
  user_id: 'testId',
};
const authUserID = 'authUserID';
const otherUserID = 'otherUserID';
const testDeviceId = 'testDeviceId';
const mockSessionKey = `${authUserID}-mock-session-999`;
const mockDrinkingSession = createMockSession(new Date());
const mockUserStatus = createMockUserStatus(
  mockSessionKey,
  mockDrinkingSession,
);
const mockSessionPlaceholder = mockDrinkingSession;

describeWithEmulator('Test account creations rules', () => {
  let testEnv: RulesTestEnvironment;
  let authDb: any; // firebase.database.Database
  let unauthDb: any; // firebase.database.Database
  let adminDb: any;
  const deviceRef = DBPATHS.ACCOUNT_CREATIONS_DEVICE_ID.getRoute(testDeviceId);
  const authUserRef = DBPATHS.ACCOUNT_CREATIONS_DEVICE_ID_USER_ID.getRoute(
    testDeviceId,
    authUserID,
  );
  setupGlobalMocks(); // Silence permission denied warnings

  beforeAll(async () => {
    ({testEnv, authDb, unauthDb, adminDb} = await FBRules.setup());
  });

  afterEach(async () => {
    await testEnv.clearDatabase();
  });

  afterAll(async () => {
    await FBRules.teardown(testEnv);
  });

  it('should allow an authenticated user to write into their own account creations node', async () => {
    const authRef = authDb.ref(authUserRef);
    await assertSucceeds(authRef.set(Date.now()));
  });

  it('should not allow an authenticated user to write into other user account creations device node', async () => {
    const authRef = authDb.ref(deviceRef);
    await assertFails(authRef.set({otherUserID: Date.now()}));
  });

  it('should allow an authenticated user to read from the device ID node', async () => {
    const authRef = authDb.ref(deviceRef);
    await assertSucceeds(authRef.get());
  });
});

describeWithEmulator('Test drinking session rules', () => {
  let testEnv: RulesTestEnvironment;
  let authDb: any; // firebase.database.Database
  let unauthDb: any; // firebase.database.Database
  let adminDb: any;
  const user1DrinkingsessionsRef =
    DBPATHS.USER_DRINKING_SESSIONS_USER_ID.getRoute(testFeedbackId);
  const authUserDrinkingsessionsRef =
    DBPATHS.USER_DRINKING_SESSIONS_USER_ID.getRoute(authUserID);
  const otherUserDrinkingsessionsRef =
    DBPATHS.USER_DRINKING_SESSIONS_USER_ID.getRoute(otherUserID);
  setupGlobalMocks(); // Silence permission denied warnings

  beforeAll(async () => {
    ({testEnv, authDb, unauthDb, adminDb} = await FBRules.setup());
  });

  afterEach(async () => {
    await testEnv.clearDatabase();
  });

  afterAll(async () => {
    await FBRules.teardown(testEnv);
  });

  it('should allow admins to write into the drinking sessions node', async () => {
    const adminRef = adminDb.ref(user1DrinkingsessionsRef);
    await assertSucceeds(adminRef.set(testFeedback));
  });

  it('should not allow authenticated user to write into the drinking sessions node', async () => {
    const authRef = authDb.ref(user1DrinkingsessionsRef);
    await assertFails(authRef.set(testFeedback));
  });

  it('should not allow unauthenticated user to write into the drinking sessions node', async () => {
    const unauthRef = unauthDb.ref(user1DrinkingsessionsRef);
    await assertFails(unauthRef.set(testFeedback));
  });

  it('should allow admins to read into the drinking sessions node', async () => {
    const adminRef = adminDb.ref(user1DrinkingsessionsRef);
    await assertSucceeds(adminRef.get(testFeedback));
  });

  it('should not allow authenticated user to read into the drinking sessions node', async () => {
    const authRef = authDb.ref(user1DrinkingsessionsRef);
    await assertFails(authRef.get(testFeedback));
  });

  it('should not allow unauthenticated user to read into the drinking sessions node', async () => {
    const unauthRef = unauthDb.ref(user1DrinkingsessionsRef);
    await assertFails(unauthRef.get(testFeedback));
  });

  it('should allow the user themselves to write into their own data', async () => {
    const authRef = authDb.ref(authUserDrinkingsessionsRef);
    const mockDrinkingSession = createMockSession(new Date());
    await assertSucceeds(authRef.set(mockDrinkingSession));
  });

  it("should not allow a user to write into other user's data", async () => {
    const authRef = authDb.ref(otherUserDrinkingsessionsRef);
    const mockDrinkingSession = createMockSession(new Date());
    await assertFails(authRef.set(mockDrinkingSession));
  });

  it('should allow the user to read their own drinking session data', async () => {
    const authRef = authDb.ref(authUserDrinkingsessionsRef);
    await assertSucceeds(authRef.get());
  });

  it("should allow a user to read friend's drinking session data", async () => {
    await makeFriends(authDb, authUserID, otherUserID); // Set the friend connection first
    const authRef = authDb.ref(otherUserDrinkingsessionsRef);
    await assertSucceeds(authRef.get());
  });

  it('should not allow a user to drinking session data of a non-friend', async () => {
    const authRef = authDb.ref(otherUserDrinkingsessionsRef);
    await assertFails(authRef.get());
  });
});

describeWithEmulator('Test user preferences rules', () => {
  let testEnv: RulesTestEnvironment;
  let authDb: any; // firebase.database.Database
  let unauthDb: any; // firebase.database.Database
  let adminDb: any;
  const authPreferencesRef =
    DBPATHS.USER_PREFERENCES_USER_ID.getRoute(authUserID);
  const otherPreferencesRef =
    DBPATHS.USER_PREFERENCES_USER_ID.getRoute(otherUserID);
  const authFirstDayOfWeekRef =
    DBPATHS.USER_PREFERENCES_USER_ID_FIRST_DAY_OF_WEEK.getRoute(authUserID);
  const authUnitsToColorsRef =
    DBPATHS.USER_PREFERENCES_USER_ID_UNITS_TO_COLORS.getRoute(authUserID);
  const authDrinksToUnitsRef =
    DBPATHS.USER_PREFERENCES_USER_ID_DRINKS_TO_UNITS.getRoute(authUserID);
  setupGlobalMocks(); // Silence permission denied warnings

  beforeAll(async () => {
    ({testEnv, authDb, unauthDb, adminDb} = await FBRules.setup());
  });

  afterEach(async () => {
    await testEnv.clearDatabase();
  });

  afterAll(async () => {
    await FBRules.teardown(testEnv);
  });

  it('should allow an authenticated user to set default preferences', async () => {
    const defaultPreferences = getDefaultPreferences();
    const authRef = authDb.ref(authPreferencesRef);
    await assertSucceeds(authRef.set(defaultPreferences));
  });

  it('should allow an authenticater user to read their own preferences', async () => {
    const authRef = authDb.ref(authPreferencesRef);
    await assertSucceeds(authRef.get());
  });

  it("should not allow general authenticated users to read other user's preferences", async () => {
    const authRef = authDb.ref(otherPreferencesRef);
    await assertFails(authRef.get());
  });

  it("should allow authenticated friend users to read other user's preferences", async () => {
    await makeFriends(authDb, authUserID, otherUserID);
    const authRef = authDb.ref(otherPreferencesRef);
    await assertSucceeds(authRef.get());
  });

  it('should allow an authenticated user to set their preferred day of week', async () => {
    const authRef = authDb.ref(authFirstDayOfWeekRef);
    await assertSucceeds(authRef.set('Monday'));
    await assertSucceeds(authRef.set('Sunday'));
  });

  it('should not allow an authenticated user to set incorrect day of week', async () => {
    const authRef = authDb.ref(authFirstDayOfWeekRef);
    await assertFails(authRef.set('Wednesday'));
    await assertFails(authRef.set(123));
  });

  it('should allow an authenticated user to set their units to colors data', async () => {
    const authRef = authDb.ref(authUnitsToColorsRef);
    await assertSucceeds(authRef.set(SAMPLE_UNITS_TO_COLORS));
  });

  it('should allow an authenticated user to set their drinks to units data', async () => {
    const authRef = authDb.ref(authDrinksToUnitsRef);
    await assertSucceeds(authRef.set(SAMPLE_DRINKS_TO_UNITS));
  });
});

describeWithEmulator('Test feedback rules', () => {
  let testEnv: RulesTestEnvironment;
  let authDb: any;
  let unauthDb: any;
  let adminDb: any;
  const feedbackRef = DBPATHS.FEEDBACK_FEEDBACK_ID.getRoute(testFeedbackId);
  setupGlobalMocks(); // Silence permission denied warnings

  beforeAll(async () => {
    ({testEnv, authDb, unauthDb, adminDb} = await FBRules.setup());
  });

  afterEach(async () => {
    await testEnv.clearDatabase();
  });

  afterAll(async () => {
    await FBRules.teardown(testEnv);
  });

  it('should write feedback when authorized', async () => {
    const authRef = authDb.ref(feedbackRef);
    await assertSucceeds(authRef.set(testFeedback));
  });

  it('should not write feedback when unauthorized', async () => {
    const unauthRef = unauthDb.ref(feedbackRef);
    await assertFails(unauthRef.set(testFeedback));
  });

  it('should allow reading feedback when admin is true', async () => {
    const authRef = adminDb.ref(feedbackRef);
    await assertSucceeds(authRef.get());
  });

  it('should not read feedback when not an admin', async () => {
    const unauthRef = unauthDb.ref(feedbackRef);
    await assertFails(unauthRef.get());
  });
});

describeWithEmulator('Test user session placeholder rules', () => {
  let testEnv: RulesTestEnvironment;
  let authDb: any;
  let unauthDb: any;
  let adminDb: any;
  const userSessionPlaceholderRef = DBPATHS.USER_SESSION_PLACEHOLDER;
  const placeholderRef =
    DBPATHS.USER_SESSION_PLACEHOLDER_USER_ID.getRoute(authUserID);
  const otherUserPlaceholderRef =
    DBPATHS.USER_SESSION_PLACEHOLDER_USER_ID.getRoute(otherUserID);
  setupGlobalMocks(); // Silence permission denied warnings

  beforeAll(async () => {
    ({testEnv, authDb, unauthDb, adminDb} = await FBRules.setup());
  });

  afterEach(async () => {
    await testEnv.clearDatabase();
  });

  afterAll(async () => {
    await FBRules.teardown(testEnv);
  });

  it('should allow reading user session placeholder node when admin is true', async () => {
    const authRef = adminDb.ref(placeholderRef);
    await assertSucceeds(authRef.get());
  });

  it('should not allow reading user session placeholder node when not an admin', async () => {
    const authRef = authDb.ref(placeholderRef);
    const unauthRef = unauthDb.ref(placeholderRef);
    await assertFails(authRef.get());
    await assertFails(unauthRef.get());
  });

  it('should allow writing to user session placeholder node when admin is true', async () => {
    const authRef = adminDb.ref(placeholderRef);
    await assertSucceeds(authRef.set({test_user: mockSessionPlaceholder}));
  });

  it('should not allow writing to user session placeholder node when not an admin', async () => {
    const authRef = authDb.ref(placeholderRef);
    const unauthRef = unauthDb.ref(placeholderRef);
    await assertFails(authRef.set({test_user: mockSessionPlaceholder}));
    await assertFails(unauthRef.set({test_user: mockSessionPlaceholder}));
  });

  it('should allow an authenticated user to write to their own session placeholder node', async () => {
    const authRef = authDb.ref(userSessionPlaceholderRef);
    await assertSucceeds(authRef.set({test_user: mockSessionPlaceholder}));
  });

  it("should not allow an authenticated user to write to other users' session placeholder node", async () => {
    const authRef = authDb.ref(otherUserPlaceholderRef);
    await assertFails(authRef.set({test_user: mockSessionPlaceholder}));
  });

  it('should allow an authenticated user to read own session placeholder', async () => {
    const authRef = authDb.ref(userSessionPlaceholderRef);
    await assertSucceeds(authRef.get());
  });

  it('should not allow an authenticated user to read other user session placeholder node', async () => {
    const authRef = authDb.ref(otherUserPlaceholderRef);
    await assertFails(authRef.get());
  });
});

describeWithEmulator('Test user status rules', () => {
  let testEnv: RulesTestEnvironment;
  let authDb: any;
  let unauthDb: any;
  let adminDb: any;
  const userStatusRef = DBPATHS.USER_STATUS;
  const authUserStatusRef = DBPATHS.USER_STATUS_USER_ID.getRoute(authUserID);
  const otherUserStatusRef = DBPATHS.USER_STATUS_USER_ID.getRoute(otherUserID);
  setupGlobalMocks(); // Silence permission denied warnings

  beforeAll(async () => {
    ({testEnv, authDb, unauthDb, adminDb} = await FBRules.setup());
  });

  afterEach(async () => {
    await testEnv.clearDatabase();
  });

  afterAll(async () => {
    await FBRules.teardown(testEnv);
  });

  it('should allow reading user user status node when admin is true', async () => {
    const authRef = adminDb.ref(userStatusRef);
    await assertSucceeds(authRef.get());
  });

  it('should not allow reading user user status node when not an admin', async () => {
    const authRef = authDb.ref(userStatusRef);
    const unauthRef = unauthDb.ref(userStatusRef);
    await assertFails(authRef.get());
    await assertFails(unauthRef.get());
  });

  it('should allow writing to user user status node when admin is true', async () => {
    const authRef = adminDb.ref(userStatusRef);
    await assertSucceeds(authRef.set({test_user: mockUserStatus}));
  });

  it('should not allow writing to user user status node when not an admin', async () => {
    const authRef = authDb.ref(userStatusRef);
    const unauthRef = unauthDb.ref(userStatusRef);
    await assertFails(authRef.set({test_user: mockUserStatus}));
    await assertFails(unauthRef.set({test_user: mockUserStatus}));
  });

  it('should allow an authenticated user to write into their own user status node', async () => {
    const authRef = authDb.ref(authUserStatusRef);
    await assertSucceeds(authRef.set(mockUserStatus));
  });

  it('should not allow an authenticated user to write with incorrect values into their own user status node', async () => {
    const authRef = authDb.ref(authUserStatusRef);
    await assertFails(authRef.set(123));
  });

  it("should not allow an authenticated user to write into other user's user status nodes", async () => {
    const authRef = authDb.ref(otherUserStatusRef);
    await assertFails(authRef.set(mockUserStatus));
  });

  it('should not allow an unauthenticated user to write into their own user status node', async () => {
    const unauthRef = unauthDb.ref(authUserStatusRef);
    await assertFails(unauthRef.set(mockUserStatus));
  });

  it('should allow an authenticated user to read their own user status node', async () => {
    const authRef = authDb.ref(authUserStatusRef);
    await assertSucceeds(authRef.get());
  });

  it("should not allow an authenticated user to read other users' user status node", async () => {
    const authRef = authDb.ref(otherUserStatusRef);
    await assertFails(authRef.get());
  });

  it("should allow an authenticated user to read their friends' user status node", async () => {
    await makeFriends(authDb, authUserID, otherUserID); // Set the friend connection first
    const authRef = authDb.ref(otherUserStatusRef);
    await assertSucceeds(authRef.get());
  });

  it('should not allow an authenticated user to read their own user status node', async () => {
    const authRef = unauthDb.ref(authUserStatusRef);
    await assertFails(authRef.get());
  });
});

describeWithEmulator('Test user last online rules', () => {
  let testEnv: RulesTestEnvironment;
  let authDb: any;
  let unauthDb: any;
  let adminDb: any;
  const authUserLastOnlineRef =
    DBPATHS.USER_STATUS_USER_ID_LAST_ONLINE.getRoute(authUserID);
  const otherUserLastOnlineRef =
    DBPATHS.USER_STATUS_USER_ID_LAST_ONLINE.getRoute(otherUserID);
  setupGlobalMocks(); // Silence permission denied warnings

  beforeAll(async () => {
    ({testEnv, authDb, unauthDb, adminDb} = await FBRules.setup());
  });

  afterEach(async () => {
    await testEnv.clearDatabase();
  });

  afterAll(async () => {
    await FBRules.teardown(testEnv);
  });

  it('should allow an authenticated user to write into their own user last online node', async () => {
    const authRef = authDb.ref(authUserLastOnlineRef);
    await assertSucceeds(authRef.set(123));
  });

  it('should not allow an authenticated user to write with incorrect values into their own user last online node', async () => {
    const authRef = authDb.ref(authUserLastOnlineRef);
    await assertFails(authRef.set('not a number'));
  });

  it("should not allow an authenticated user to write into other user's user last online nodes", async () => {
    const authRef = authDb.ref(otherUserLastOnlineRef);
    await assertFails(authRef.set(123));
  });

  it('should not allow an unauthenticated user to write into their own user last online node', async () => {
    const unauthRef = unauthDb.ref(authUserLastOnlineRef);
    await assertFails(unauthRef.set(123));
  });

  it('should allow an authenticated user to read their own user last online node', async () => {
    const authRef = authDb.ref(authUserLastOnlineRef);
    await assertSucceeds(authRef.get());
  });

  it("should not allow an authenticated user to read other users' user last online node", async () => {
    const authRef = authDb.ref(otherUserLastOnlineRef);
    await assertFails(authRef.get());
  });

  it("should allow an authenticated user to read their friends' user last online node", async () => {
    await makeFriends(authDb, authUserID, otherUserID); // Set the friend connection first
    const authRef = authDb.ref(otherUserLastOnlineRef);
    await assertSucceeds(authRef.get());
  });

  it('should not allow an authenticated user to read their own user last online node', async () => {
    const authRef = unauthDb.ref(authUserLastOnlineRef);
    await assertFails(authRef.get());
  });
});

describeWithEmulator('Test friend rules', () => {
  let testEnv: RulesTestEnvironment;
  let authDb: any;
  let unauthDb: any;
  let adminDb: any;
  const fromAuthToOtherRef = DBPATHS.USERS_USER_ID_FRIENDS_FRIEND_ID.getRoute(
    authUserID,
    otherUserID,
  );
  const fromOtherToAuthRef = DBPATHS.USERS_USER_ID_FRIENDS_FRIEND_ID.getRoute(
    otherUserID,
    authUserID,
  );
  const authFriendsRef = DBPATHS.USERS_USER_ID_FRIENDS.getRoute(authUserID);
  setupGlobalMocks(); // Silence permission denied warnings

  beforeAll(async () => {
    ({testEnv, authDb, unauthDb, adminDb} = await FBRules.setup());
  });

  afterEach(async () => {
    await testEnv.clearDatabase();
  });

  afterAll(async () => {
    await FBRules.teardown(testEnv);
  });

  it('should allow a user to write valid values into their own friend list', async () => {
    const authRef = authDb.ref(fromAuthToOtherRef);
    await assertSucceeds(authRef.set(true));
    await assertSucceeds(authRef.set(null));
  });

  it("should allow a user to write valid values into other user's friend list", async () => {
    const authRef = authDb.ref(fromOtherToAuthRef);
    await assertSucceeds(authRef.set(true));
    await assertSucceeds(authRef.set(null));
  });

  it('should not allow a user to write their own name into their friend list', async () => {
    const authRef = authDb.ref(fromAuthToOtherRef);
    await assertFails(authRef.set(true));
  });

  it('should not allow writing invalid values into their friend list', async () => {
    const authRef = authDb.ref(fromAuthToOtherRef);
    await assertFails(authRef.set('invalid'));
  });

  it("should not allow writing invalid values into other user's friend list", async () => {
    const authRef = authDb.ref(fromOtherToAuthRef);
    await assertFails(authRef.set('invalid'));
  });

  it('should allow reading own friend list when authenticated', async () => {
    const authRef = authDb.ref(authFriendsRef);
    await assertSucceeds(authRef.get());
  });

  it('should not allow reading own friend list when unauthenticated', async () => {
    const unauthRef = unauthDb.ref(authFriendsRef);
    await assertFails(unauthRef.get());
  });
});

describeWithEmulator('Test friend request rules', () => {
  let testEnv: RulesTestEnvironment;
  let authDb: any;
  let unauthDb: any;
  let adminDb: any;
  const sentFriendRequest: string = CONST.FRIEND_REQUEST_STATUS.SENT;
  const receivedFriendRequest: string = CONST.FRIEND_REQUEST_STATUS.RECEIVED;
  const friendRequestRef = DBPATHS.USERS_USER_ID_FRIEND_REQUESTS_REQUEST_ID;
  const friendRequestNodeRef = DBPATHS.USERS_USER_ID_FRIEND_REQUESTS;
  const fromAuthToOtherRef = friendRequestRef.getRoute(authUserID, otherUserID);
  const fromOtherToAuthRef = friendRequestRef.getRoute(otherUserID, authUserID);
  const fromOtherToOtherRef = friendRequestRef.getRoute(
    otherUserID,
    otherUserID,
  );
  const authFriendRequestRef = friendRequestNodeRef.getRoute(authUserID);
  const otherFriendRequestRef = friendRequestNodeRef.getRoute(otherUserID);

  const fromAuthToAuthRef = setupGlobalMocks(); // Silence permission denied warnings

  beforeAll(async () => {
    ({testEnv, authDb, unauthDb, adminDb} = await FBRules.setup());
  });

  afterEach(async () => {
    await testEnv.clearDatabase();
  });

  afterAll(async () => {
    await FBRules.teardown(testEnv);
  });

  it('should allow authenticated user to write into their own friend_requests with valid values', async () => {
    const authRef = authDb.ref(fromAuthToOtherRef);
    await assertSucceeds(authRef.set(sentFriendRequest));
    await assertSucceeds(authRef.set(null));
  });

  it('should not allow authenticated user to write into their own friend_requests with invalid values', async () => {
    const authRef = authDb.ref(fromAuthToOtherRef);
    await assertFails(authRef.set(123));
    await assertFails(authRef.set('rejected'));
  });

  it("should allow authenticated user to write into other user's friend_requests with their own id", async () => {
    const authRef = authDb.ref(fromOtherToAuthRef);
    await assertSucceeds(authRef.set(receivedFriendRequest));
    await assertSucceeds(authRef.set(null));
  });

  it("should not allow authenticated user to write into other user's friend_requests with different id", async () => {
    const authRef = authDb.ref(fromOtherToOtherRef);

    // Attempt to write under different id into the other user's friend_requests database part
    await assertFails(authRef.set(receivedFriendRequest));
  });

  it("should not allow authenticated user to write into other user's friend_requests any value other than received", async () => {
    const authRef = authDb.ref(fromOtherToOtherRef);
    await assertFails(authRef.set(123));
    await assertFails(authRef.set(sentFriendRequest));
  });

  it('should not allow writing invalid values to friend_requests node', async () => {
    const authRef = authDb.ref(authFriendRequestRef);
    await assertFails(authRef.set(123));
    await assertFails(authRef.set(true));
  });

  it('should allow writing valid values to own friend_requests node', async () => {
    const authRef = authDb.ref(authFriendRequestRef);
    await assertSucceeds(authRef.set(null));
  });

  it('should not allow writing valid values to other friend_requests node', async () => {
    const authRef = authDb.ref(otherFriendRequestRef);
    await assertFails(authRef.set(null));
  });

  it('should not allow the user to write their own name into their friend_requests', async () => {
    const authRef = authDb.ref(fromAuthToAuthRef);
    await assertFails(authRef.set(sentFriendRequest));
  });

  it('should not allow a user to send a friend request to a user they are already friends with', async () => {
    await makeFriends(authDb, authUserID, otherUserID); // Set the friend connection first
    const authRef = authDb.ref(fromOtherToAuthRef);
    await assertFails(authRef.set(receivedFriendRequest));
  });

  it('should not allow a user to write into their own friend request an id of a user they are already friends with', async () => {
    await makeFriends(authDb, authUserID, otherUserID); // Set the friend connection first
    const authRef = authDb.ref(fromAuthToOtherRef);
    await assertFails(authRef.set(sentFriendRequest));
  });

  it('should allow reading own friend_requests when authenticated', async () => {
    const authRef = authDb.ref(authFriendRequestRef);
    await assertSucceeds(authRef.get());
  });

  it('should not allow reading own friend_requests when unauthenticated', async () => {
    const unauthRef = unauthDb.ref(authFriendRequestRef);
    await assertFails(unauthRef.get());
  });

  it("should not allow reading other people's friend requests", async () => {
    const authDb = testEnv.authenticatedContext(authUserID).database();
    const authRef = authDb.ref(otherFriendRequestRef);
    await assertFails(authRef.get());
  });

  // Check that the rules correctly reject writing to non-existent users
});

// TODO
// Test out config, rest of the rules
// Make an explicit list of opperations the user can do (has to do) before being authenticated
