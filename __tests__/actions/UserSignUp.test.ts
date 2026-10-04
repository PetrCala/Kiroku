/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable @typescript-eslint/unbound-method -- references to mocked methods are read-only assertions, not actual call sites */
/* eslint-disable rulesdir/no-api-in-views -- this test drives the mocked API.makeRequestWithSideEffects pipeline; it is not a view */
/* eslint-disable rulesdir/prefer-actions-set-data -- the mocked Onyx.set is only read back to assert what the action wrote */

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from 'firebase/auth';
import type {Auth, User} from 'firebase/auth';
import Onyx from 'react-native-onyx';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import Log from '@libs/Log';
import ERRORS from '@src/ERRORS';
import ONYXKEYS from '@src/ONYXKEYS';
import * as UserActions from '@userActions/User';

/**
 * The verification email is fired by sign-up and not awaited, so a rejection
 * (the relay is down, the project is out of quota) used to vanish: nothing on
 * screen, nothing in Crashlytics, and a modal telling the user to check an
 * inbox with nothing in it. These pin down the marker that makes the modal
 * truthful and the alert that makes the failure visible to us.
 */

// Stub Onyx so importing User.ts doesn't start real Onyx.connect timers, which
// otherwise fire after the jest environment is torn down and crash the run.
jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    update: jest.fn(() => Promise.resolve()),
    merge: jest.fn(() => Promise.resolve()),
    set: jest.fn(() => Promise.resolve()),
    METHOD: {MERGE: 'merge', SET: 'set'},
  },
  useOnyx: jest.fn(),
}));

jest.mock('@libs/Firebase/FirebaseApp', () => ({
  getFirebaseAuth: () => ({currentUser: {uid: 'user-1'}}),
}));

// User.ts pulls native-only modules (apple-auth via OAuthCredential) that jest
// can't transform; stub them so importing the action under test doesn't load them.
jest.mock('@libs/OAuthCredential', () => ({getOAuthCredential: jest.fn()}));
jest.mock('@userActions/Session', () => ({clearSignInData: jest.fn()}));

// Log schedules a periodic flush timer at import that fires after teardown.
jest.mock('@libs/Log', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    alert: jest.fn(),
    hmmm: jest.fn(),
  },
}));

jest.mock('@libs/Pusher/pusher', () => ({
  TYPE: {
    ONYX_API_UPDATE: 'onyxApiUpdate',
    MULTIPLE_EVENT_TYPE: {ONYX_API_UPDATE: 'onyxApiUpdate'},
  },
}));

jest.mock('@libs/PusherUtils', () => ({
  __esModule: true,
  default: {
    subscribeToMultiEvent: jest.fn(),
    subscribeToPrivateUserChannelEvent: jest.fn(),
    subscribeToPublicChannelEvent: jest.fn(),
  },
}));

jest.mock('@userActions/OnyxUpdates', () => ({
  apply: jest.fn(),
  saveUpdateInformation: jest.fn(),
  doesClientNeedToBeUpdated: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  signInWithCredential: jest.fn(),
  updateProfile: jest.fn(() => Promise.resolve()),
  EmailAuthProvider: {credential: jest.fn()},
  GoogleAuthProvider: {credential: jest.fn()},
  OAuthProvider: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  linkWithCredential: jest.fn(),
  reauthenticateWithCredential: jest.fn(),
  sendEmailVerification: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  unlink: jest.fn(),
  updatePassword: jest.fn(),
  verifyBeforeUpdateEmail: jest.fn(),
}));

// Both the version gate and provisionUser route through
// API.makeRequestWithSideEffects. An empty body means "no minimum version" to
// the gate and "provisioned" to the caller.
jest.mock('@libs/API', () => ({
  makeRequestWithSideEffects: jest.fn(),
  write: jest.fn(),
  read: jest.fn(),
}));

const mockedCreateUser = jest.mocked(createUserWithEmailAndPassword);
const mockedSendEmailVerification = jest.mocked(sendEmailVerification);
const mockedRequest = jest.mocked(API.makeRequestWithSideEffects);
const mockedOnyxSet = jest.mocked(Onyx.set);
const mockedAlert = jest.mocked(Log.alert);

const fakeAuth = {} as Auth;
const newUser = {
  uid: 'new-uid',
  email: 'jane@example.com',
  delete: jest.fn(() => Promise.resolve()),
} as unknown as User;

const SEND_FAILED_ALERT =
  '[sendVerifyEmailLink] failed to send verification email';

function firebaseError(code: string): Error {
  return Object.assign(new Error(`Firebase: Error (${code}).`), {code});
}

const flushPromises = () =>
  new Promise(resolve => {
    process.nextTick(resolve);
  });

/** Every value written to the send-failed marker, in order. */
function markerWrites(): unknown[] {
  return mockedOnyxSet.mock.calls
    .filter(([key]) => key === ONYXKEYS.VERIFY_EMAIL_SEND_FAILED)
    .map(([, value]) => value);
}

function sentTimestampWrites(): unknown[] {
  return mockedOnyxSet.mock.calls
    .filter(([key]) => key === ONYXKEYS.VERIFY_EMAIL_SENT)
    .map(([, value]) => value);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedCreateUser.mockResolvedValue({user: newUser} as Awaited<
    ReturnType<typeof createUserWithEmailAndPassword>
  >);
  mockedRequest.mockResolvedValue({});
  mockedSendEmailVerification.mockResolvedValue(undefined);
});

describe('signUp verification email', () => {
  it('marks the send as failed with the Firebase code when the first send is rejected', async () => {
    mockedSendEmailVerification.mockRejectedValue(
      firebaseError(ERRORS.AUTH.QUOTA_EXCEEDED),
    );

    await UserActions.signUp(fakeAuth, 'jane@example.com', 'hunter22');
    await flushPromises();

    // Reset on the way in, then set once the rejection lands.
    expect(markerWrites()).toEqual([null, ERRORS.AUTH.QUOTA_EXCEEDED]);
    // The cooldown timestamp means "a mail went out", so it must stay unset.
    expect(sentTimestampWrites()).toEqual([]);
  });

  it('alerts with the Firebase code, which is what reaches Crashlytics', async () => {
    mockedSendEmailVerification.mockRejectedValue(
      firebaseError(ERRORS.AUTH.QUOTA_EXCEEDED),
    );

    await UserActions.signUp(fakeAuth, 'jane@example.com', 'hunter22');
    await flushPromises();

    expect(mockedAlert).toHaveBeenCalledTimes(1);
    expect(mockedAlert).toHaveBeenCalledWith(SEND_FAILED_ALERT, {
      code: ERRORS.AUTH.QUOTA_EXCEEDED,
      message: 'Firebase: Error (auth/quota-exceeded).',
    });
  });

  it('still creates the account: the send is not what sign-up waits on', async () => {
    mockedSendEmailVerification.mockRejectedValue(
      firebaseError(ERRORS.AUTH.INTERNAL_ERROR),
    );

    await expect(
      UserActions.signUp(fakeAuth, 'jane@example.com', 'hunter22'),
    ).resolves.toBeUndefined();

    expect(mockedRequest).toHaveBeenCalledWith(
      WRITE_COMMANDS.PROVISION_USER,
      expect.anything(),
      expect.anything(),
    );
    expect(newUser.delete).not.toHaveBeenCalled();
  });

  it('falls back to the unknown key when the rejection carries no code', async () => {
    mockedSendEmailVerification.mockRejectedValue(new Error('relay is down'));

    await UserActions.signUp(fakeAuth, 'jane@example.com', 'hunter22');
    await flushPromises();

    expect(markerWrites()).toEqual([null, ERRORS.UNKNOWN]);
    expect(mockedAlert).toHaveBeenCalledWith(SEND_FAILED_ALERT, {
      code: ERRORS.UNKNOWN,
      message: 'relay is down',
    });
  });

  it('leaves no marker and no alert when the first send goes out', async () => {
    await UserActions.signUp(fakeAuth, 'jane@example.com', 'hunter22');
    await flushPromises();

    expect(markerWrites()).toEqual([null, null]);
    expect(sentTimestampWrites()).toHaveLength(1);
    expect(mockedAlert).not.toHaveBeenCalled();
  });
});

describe('sendVerifyEmailLink', () => {
  it('clears the marker once a resend goes out', async () => {
    await UserActions.sendVerifyEmailLink(newUser);

    expect(markerWrites()).toEqual([null]);
    expect(sentTimestampWrites()).toHaveLength(1);
  });

  it('alerts and rethrows when a resend is rejected, leaving the marker as it was', async () => {
    const error = firebaseError(ERRORS.AUTH.TOO_MANY_REQUESTS);
    mockedSendEmailVerification.mockRejectedValue(error);

    await expect(UserActions.sendVerifyEmailLink(newUser)).rejects.toBe(error);

    expect(mockedAlert).toHaveBeenCalledWith(SEND_FAILED_ALERT, {
      code: ERRORS.AUTH.TOO_MANY_REQUESTS,
      message: 'Firebase: Error (auth/too-many-requests).',
    });
    expect(markerWrites()).toEqual([]);
    expect(sentTimestampWrites()).toEqual([]);
  });
});
