import type {Database} from 'firebase/database';
import {update, ref, get} from 'firebase/database';
import type {
  AppSettings,
  DrinkingSessionList,
  FriendRequestList,
  NicknameToId,
  Preferences,
  Profile,
  ReasonForLeaving,
  ReasonForLeavingId,
  UserData,
  UserStatus,
} from '@src/types/onyx';
import type {Timestamp, UserID, UserList} from '@src/types/onyx/OnyxCommon';
import type {Auth, User, UserCredential} from 'firebase/auth';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  sendEmailVerification,
  signInWithEmailAndPassword,
  updatePassword as fbUpdatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import {getUniqueId} from 'react-native-device-info';
import {cleanStringForFirebaseKey} from '@libs/StringUtilsKiroku';
import DBPATHS from '@src/DBPATHS';
import {readDataOnce} from '@database/baseFunctions';
import type {FirebaseUpdates} from '@database/updates';
import {getLastStartedSessionId} from '@libs/DataHandling';
import * as Localize from '@libs/Localize';
import type {SelectedTimezone, Timezone} from '@src/types/onyx/UserData';
import {validateAppVersion} from '@libs/Validation';
import {checkAccountCreationLimit} from '@database/protection';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import type {OnyxEntry} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import CONST from '@src/CONST';
import {getReasonForLeavingID} from '@libs/ReasonForLeaving';
import Log from '@libs/Log';
import ERRORS from '@src/ERRORS';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import * as Session from './Session';

let verifyEmailSent: OnyxEntry<Timestamp | null> = null;
Onyx.connect({
  key: ONYXKEYS.VERIFY_EMAIL_SENT,
  callback: val => {
    verifyEmailSent = val;
  },
});

const getDefaultPreferences = (): Preferences => {
  return {
    first_day_of_week: 'Monday',
    units_to_colors: {
      orange: 10,
      yellow: 5,
    },
    drinks_to_units: {
      small_beer: 0.5,
      beer: 1,
      cocktail: 1.5,
      other: 1,
      strong_shot: 1,
      weak_shot: 0.5,
      wine: 1,
    },
    theme: CONST.THEME.SYSTEM,
  };
};

const getDefaultUserData = (profileData: Profile): UserData => {
  const userRole = 'open_beta_user';
  const timezone: Timezone = {
    selected: Intl.DateTimeFormat().resolvedOptions()
      .timeZone as SelectedTimezone,
    automatic: true,
  };
  return {
    profile: profileData,
    role: userRole,
    timezone,
  };
};

const getDefaultUserStatus = (): {last_online: number} => {
  return {
    last_online: new Date().getTime(),
  };
};

/**
 * Check if a user exists in the realtime database.
 *
 * @param db - The database object against which to validate this conditio
 * @param userID - User ID of the user to check.
 * @returns - Returns true if the user exists, false otherwise.
 */
async function userExistsInDatabase(
  db: Database,
  userID: string,
): Promise<boolean> {
  const profilePath = DBPATHS.USERS_USER_ID_PROFILE.getRoute(userID);
  const dbRef = ref(db, profilePath);
  const snapshot = await get(dbRef);
  return snapshot.exists();
}

/** In the database, create base info for a user. This will
 * be stored under the "users" object in the database.
 *
 * @param db The firebase realtime database object
 * @param userID The user ID
 * @param profileData Profile data of the user to create
 * @returns
 */
async function pushNewUserInfo(
  db: Database,
  userID: string,
  profileData: Profile,
): Promise<void> {
  const userNickname = profileData.display_name;
  const nicknameKey = cleanStringForFirebaseKey(userNickname);
  // Allowed types
  const deviceId = await getUniqueId(); // Use a device identifier

  const accountCreationsRef = DBPATHS.ACCOUNT_CREATIONS_DEVICE_ID_USER_ID;
  const nicknameRef = DBPATHS.NICKNAME_TO_ID_NICKNAME_KEY_USER_ID;
  const userStatusRef = DBPATHS.USER_STATUS_USER_ID;
  const userPreferencesRef = DBPATHS.USER_PREFERENCES_USER_ID;
  const userRef = DBPATHS.USERS_USER_ID;

  const updates: FirebaseUpdates = {};
  updates[accountCreationsRef.getRoute(deviceId, userID)] = Date.now();
  updates[nicknameRef.getRoute(nicknameKey, userID)] = userNickname;
  updates[userStatusRef.getRoute(userID)] = getDefaultUserStatus();
  updates[userPreferencesRef.getRoute(userID)] = getDefaultPreferences();
  updates[userRef.getRoute(userID)] = getDefaultUserData(profileData);

  await update(ref(db), updates);
}

/** Delete all user info from the realtime database, including their
 * user information, drinking sessions, etc.
 *
 *
 * @param db The firebase database object;
 * @param userID The user ID
 * @param userNickname The user nickname
 * @param friends The user's friends
 * @param friendRequests The user's friend requests
 * @param reasonForLeaving The reason for leaving
 * @returns
 */
async function deleteUserData(
  db: Database,
  userID: string,
  userNickname: string,
  friends: UserList | undefined,
  friendRequests: FriendRequestList | undefined,
  reasonForLeaving?: ReasonForLeaving,
): Promise<void> {
  const nicknameKey = cleanStringForFirebaseKey(userNickname);

  const nicknameRef = DBPATHS.NICKNAME_TO_ID_NICKNAME_KEY_USER_ID;
  const userStatusRef = DBPATHS.USER_STATUS_USER_ID;
  const userPreferencesRef = DBPATHS.USER_PREFERENCES_USER_ID;
  const userRef = DBPATHS.USERS_USER_ID;
  const drinkingSessionsRef = DBPATHS.USER_DRINKING_SESSIONS_USER_ID;
  const unconfirmedDaysRef = DBPATHS.USER_UNCONFIRMED_DAYS_USER_ID;
  const friendsRef = DBPATHS.USERS_USER_ID_FRIENDS_FRIEND_ID;
  const friendRequestsRef = DBPATHS.USERS_USER_ID_FRIEND_REQUESTS_REQUEST_ID;
  const reasonForLeavingRef = DBPATHS.REASONS_FOR_LEAVING_REASON_ID;

  const updates: Record<string, null | false | ReasonForLeaving> = {};
  updates[nicknameRef.getRoute(nicknameKey, userID)] = null;
  updates[userStatusRef.getRoute(userID)] = null;
  updates[userPreferencesRef.getRoute(userID)] = null;
  updates[userRef.getRoute(userID)] = null;
  updates[drinkingSessionsRef.getRoute(userID)] = null;
  updates[unconfirmedDaysRef.getRoute(userID)] = null;

  if (reasonForLeaving) {
    const reasonID: ReasonForLeavingId = getReasonForLeavingID(userID);
    updates[reasonForLeavingRef.getRoute(reasonID)] = reasonForLeaving;
  }

  // Data stored in other users' nodes
  if (friends) {
    Object.keys(friends).forEach(friendId => {
      updates[friendsRef.getRoute(friendId, userID)] = null;
    });
  }
  if (friendRequests) {
    Object.keys(friendRequests).forEach(friendRequestId => {
      updates[friendRequestsRef.getRoute(friendRequestId, userID)] = null;
    });
  }
  await update(ref(db), updates);
}

async function synchronizeUserStatus(
  db: Database,
  userID: string,
  drinkingSessions: DrinkingSessionList | undefined,
): Promise<void> {
  const latestSessionId = getLastStartedSessionId(drinkingSessions) ?? null;
  const latestSession =
    drinkingSessions && latestSessionId
      ? drinkingSessions[latestSessionId]
      : null;
  const newUserStatus: UserStatus = {
    last_online: new Date().getTime(),
    latest_session: latestSession,
    latest_session_id: latestSessionId,
  };
  const userStatusRef = DBPATHS.USER_STATUS_USER_ID;
  const updates: Record<string, UserStatus> = {};
  updates[userStatusRef.getRoute(userID)] = newUserStatus;
  await update(ref(db), updates);
}

/** Reauthentificate a user using the User object and a password
 * Necessary before important operations such as deleting a user
 * or changing a password.
 *
 * Return a promise with the credentials if the reauthentification succeeds,
 * or with null if it does not.
 *
 * @param user User object from firebase
 * @param password Password to reauthentificate with
 * @returns Null if the user does not exist, otherwise the result of the authentification.
 */
async function reauthentificateUser(
  user: User,
  password: string,
): Promise<void | UserCredential> {
  let email: string;
  if (user.email) {
    email = user.email;
  } else {
    Log.warn('User email not found when reauthentificating');
    return;
  }
  const credential = EmailAuthProvider.credential(email, password);
  const result = await reauthenticateWithCredential(user, credential);
  return result;
}

/**
 * Send an email to the user with a link to update their email.
 *
 * @param user The user to send the email to
 * @param newEmail The new email
 */
async function sendUpdateEmailLink(
  user: User | null,
  newEmail: string,
  password: string,
): Promise<void> {
  if (!user) {
    throw new Error(Localize.translateLocal('common.error.userNull'));
  }

  const authentificationResult: void | UserCredential =
    await reauthentificateUser(user, password);

  if (!authentificationResult) {
    throw new Error(
      Localize.translateLocal('common.error.reauthenticationFailed'),
    );
  }

  await verifyBeforeUpdateEmail(user, newEmail);
}

async function updatePassword(
  user: User | null,
  currentPassword: string,
  newPassword: string,
) {
  if (!user) {
    throw new Error(ERRORS.AUTH.USER_IS_NULL);
  }

  const authentificationResult: void | UserCredential =
    await reauthentificateUser(user, currentPassword);

  if (!authentificationResult) {
    throw new Error(
      Localize.translateLocal('common.error.reauthenticationFailed'),
    );
  }

  await fbUpdatePassword(user, newPassword);

  await Onyx.set(ONYXKEYS.FORMS.PASSWORD_FORM_DRAFT, null); // Reset upon success
}

/**
 * Send an email verification link to a user.
 *
 * @params user The user to send the email to
 * @returns A promise that resolves when the email is sent.
 */
async function sendVerifyEmailLink(user: User | null): Promise<void> {
  if (!user) {
    throw new Error(Localize.translateLocal('common.error.userNull'));
  }
  const hasSentEmailRecently =
    verifyEmailSent &&
    verifyEmailSent > Date.now() - CONST.VERIFY_EMAIL.COOLDOWN;

  if (hasSentEmailRecently) {
    throw new Error(
      Localize.translateLocal('verifyEmailScreen.error.emailSentRecently'),
    );
  }
  await sendEmailVerification(user);
  await Onyx.set(ONYXKEYS.VERIFY_EMAIL_SENT, new Date().getTime());
}

/**
 * Change a display name for a user both in the realtime database,
 *  and in the authentication system.
 *
 * @param db Database to change the display name in
 * @param user User to change the display name for
 * @param oldDisplayName The old display name
 * @param newDisplayName The new display name
 * @returns An empty promise
 */
async function changeDisplayName(
  db: Database,
  user: User | null,
  oldDisplayName: string | undefined,
  newDisplayName: string,
): Promise<void> {
  if (!user) {
    throw new Error(Localize.translateLocal('common.error.userNull'));
  }
  if (!oldDisplayName) {
    throw new Error(
      'Could not identify the old display name. Try reloading the app.',
    );
  }
  const userID = user.uid;
  const oldNicknameKey = cleanStringForFirebaseKey(oldDisplayName);
  const nicknameKey = cleanStringForFirebaseKey(newDisplayName);
  const nicknameRef = DBPATHS.NICKNAME_TO_ID_NICKNAME_KEY_USER_ID;
  const displayNameRef = DBPATHS.USERS_USER_ID_PROFILE_DISPLAY_NAME;

  const currentDisplayName = await readDataOnce<string>(
    db,
    displayNameRef.getRoute(userID),
  );
  if (currentDisplayName === newDisplayName) {
    return;
  }

  const updates: Record<string, string | null> = {};
  updates[nicknameRef.getRoute(oldNicknameKey, userID)] = null;
  updates[nicknameRef.getRoute(nicknameKey, userID)] = newDisplayName;
  updates[displayNameRef.getRoute(userID)] = newDisplayName;

  // TODO possibly rewrite these into a transaction
  await update(ref(db), updates);
  await updateProfile(user, {displayName: newDisplayName});
}

/**
 * Change a user name for a user.
 *
 * @param db Database to change the display name in
 * @param user User to change the display name for
 * @param firstName The new first name
 * @param lastName The new last name
 * @returns An empty promise
 */
async function changeUserName(
  db: Database,
  user: User | null,
  firstName: string,
  lastName: string,
): Promise<void> {
  if (!user) {
    throw new Error(Localize.translateLocal('common.error.userNull'));
  }

  const userID = user.uid;
  const firstNameRef = DBPATHS.USERS_USER_ID_PROFILE_FIRST_NAME;
  const lastNameRef = DBPATHS.USERS_USER_ID_PROFILE_LAST_NAME;

  const updates: Record<string, string> = {};
  updates[firstNameRef.getRoute(userID)] = firstName;
  updates[lastNameRef.getRoute(userID)] = lastName;

  await update(ref(db), updates);
}

/**
 * Fetches the Firebase nickname of an array of users. Returns these nicknames as a mapping object in the form of {[userId]: userNickname}.
 *
 * @param db The Realtime Database instance.
 * @param uid The user's UID.
 * @returns{Promise<string|null>} The nickname or null if not found.
 *
 * @example const userNickname = await fetchNicknameByUID(db, "userUIDHere");
 */
async function fetchUserNicknames(
  db: Database,
  userIds: UserID[],
): Promise<NicknameToId> {
  if (isEmptyObject(userIds)) {
    return {};
  }
  const urls = userIds.map(userId =>
    DBPATHS.USERS_USER_ID_PROFILE.getRoute(userId),
  );

  const fetchPromises = urls.map(url =>
    readDataOnce<Profile>(db, url).then(response => response),
  );

  const results = await Promise.all(fetchPromises);

  if (!results) {
    return {};
  }

  return userIds.reduce((acc, key, index) => {
    acc[key] = results[index]?.display_name ?? '';
    return acc;
  }, {} as NicknameToId);
}

/** Fetch the timestamp of when a user last agreed to terms and conditions */
async function fetchLastAgreedToTermsAt(
  db: Database,
  userID: UserID,
): Promise<Timestamp | null> {
  const agreedToTermsAtRef = DBPATHS.USERS_USER_ID_AGREED_TO_TERMS_AT;
  const agreedToTermsAt = await readDataOnce<Timestamp>(
    db,
    agreedToTermsAtRef.getRoute(userID),
  );
  return agreedToTermsAt;
}

/**
 * Change a user's automatic timezone setting.
 *
 * @param db Database to change the display name in
 * @param user User to change the display name for
 * @param isAutomatic Whether the timezone is automatic
 * @param newTimezone A new timezone
 * @returns An empty promise
 */
async function updateAutomaticTimezone(
  db: Database,
  user: User | null,
  isAutomatic: boolean,
  selectedTimezone: SelectedTimezone,
): Promise<void> {
  if (!user) {
    throw new Error(Localize.translateLocal('common.error.userNull'));
  }

  const userID = user.uid;
  const timezoneRef = DBPATHS.USERS_USER_ID_TIMEZONE;

  const newData: Timezone = {
    selected: selectedTimezone,
    automatic: isAutomatic,
  };

  const updates: Record<string, Timezone> = {};
  updates[timezoneRef.getRoute(userID)] = newData;

  await update(ref(db), updates);

  await Onyx.merge(ONYXKEYS.USER_DATA_LIST, {
    [userID]: {timezone: newData},
  });
}

/**
 * Update the agreed to terms at timestamp for a user.
 *
 * @param db The Firebase database object
 * @param user The user to update the agreed to terms at timestamp for
 */
async function updateAgreedToTermsAt(
  db: Database,
  user: User | null,
): Promise<void> {
  if (!user) {
    throw new Error(Localize.translateLocal('common.error.userNull'));
  }

  const userID = user.uid;
  const agreedToTermsAtRef = DBPATHS.USERS_USER_ID_AGREED_TO_TERMS_AT;

  const updates: Record<string, number> = {};
  updates[agreedToTermsAtRef.getRoute(userID)] = Date.now();

  await update(ref(db), updates);

  await Onyx.merge(ONYXKEYS.USER_DATA_LIST, {
    [userID]: {agreed_to_terms_at: Date.now()},
  });
}

/**
 * Change a user's selected timezone
 *
 * @param db Database to change the display name in
 * @param user User to change the display name for
 * @param selectedTimezone The selected timezone
 * @returns An empty promise
 */
async function saveSelectedTimezone(
  db: Database,
  user: User | null,
  selectedTimezone: SelectedTimezone,
): Promise<void> {
  if (!user) {
    throw new Error(Localize.translateLocal('common.error.userNull'));
  }

  const userID = user.uid;
  const timezoneRef = DBPATHS.USERS_USER_ID_TIMEZONE_SELECTED;

  const updates: Record<string, SelectedTimezone> = {};
  updates[timezoneRef.getRoute(userID)] = selectedTimezone;

  await update(ref(db), updates);

  await Onyx.merge(ONYXKEYS.USER_DATA_LIST, {
    [userID]: {timezone: {selected: selectedTimezone}},
  });
}

/** Set the information about when the verify email modal was last dismissed */
async function setVerifyEmailDismissed(timestamp: Timestamp): Promise<void> {
  await Onyx.merge(ONYXKEYS.VERIFY_EMAIL_DISMISSED, timestamp);
}

/** Set the information about when the app update was last dimmissed */
async function setAppUpdateDismissed(timestamp: Timestamp): Promise<void> {
  await Onyx.merge(ONYXKEYS.APP_UPDATE_DISMISSED, timestamp);
}

/** Attempt to log in to the Firebase authentication service with a user's credentials
 *
 * @param auth The Firebase authentication object
 * @param email The user's email
 * @param password The user's password
 */
async function logIn(
  auth: Auth,
  email: string,
  password: string,
): Promise<void> {
  // Stash the credentials in case the log in fails
  Onyx.merge(ONYXKEYS.FORMS.LOG_IN_FORM_DRAFT, {
    email,
    password,
  });
  await signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign up a user to the authentication service using an email and a password
 *
 * @param db The Firebase database object
 * @param auth The Firebase authentication object
 * @param email The new user's email
 * @param username The new user's username
 * @param password The new user's password
 */
async function signUp(
  db: Database,
  auth: Auth,
  email: string,
  username: string,
  password: string,
): Promise<void> {
  // Stash the sign up credentials in case the request fails
  Onyx.merge(ONYXKEYS.FORMS.SIGN_UP_FORM_DRAFT, {
    email,
    username,
    password,
    reEnterPassword: password,
  });
  const appSettings = await readDataOnce<AppSettings>(
    db,
    DBPATHS.CONFIG_APP_SETTINGS,
  );

  if (!appSettings) {
    throw new Error('database/data-fetch-failed');
  }

  if (!validateAppVersion(appSettings).success) {
    throw new Error('database/outdated-app-version');
  }

  // Validate that the user is not spamming account creation
  const isWithinCreationLimit = await checkAccountCreationLimit(db);
  if (!isWithinCreationLimit) {
    throw new Error('database/account-creation-limit-exceeded');
  }

  // Pushing initial user data to Realtime Database
  const newProfileData: Profile = {
    display_name: username,
    photo_url: '',
  };

  // Create the user in the Firebase authentication
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );
  const newUser = userCredential.user;
  const newUserID = newUser.uid;

  try {
    // Realtime Database updates
    await pushNewUserInfo(db, newUserID, newProfileData);

    // Update Firebase authentication
    await updateProfile(newUser, {displayName: username});

    Session.clearSignInData();

    Navigation.navigate(ROUTES.HOME);
  } catch (error) {
    // Attempt to rollback the changes if the 'transaction' fails
    await deleteUserData(
      db,
      newUserID,
      newProfileData.display_name,
      undefined,
      undefined,
    );

    // Delete the user from Firebase authentication
    await newUser.delete();
    throw new Error('database/user-creation-failed');
  }
}

export {
  changeDisplayName,
  changeUserName,
  deleteUserData,
  fetchLastAgreedToTermsAt,
  fetchUserNicknames,
  getDefaultPreferences,
  getDefaultUserData,
  getDefaultUserStatus,
  pushNewUserInfo,
  reauthentificateUser,
  saveSelectedTimezone,
  sendUpdateEmailLink,
  sendVerifyEmailLink,
  setAppUpdateDismissed,
  setVerifyEmailDismissed,
  synchronizeUserStatus,
  updateAgreedToTermsAt,
  updateAutomaticTimezone,
  updatePassword,
  userExistsInDatabase,
  logIn,
  signUp,
};
