/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable @typescript-eslint/unbound-method -- references to mocked methods are read-only assertions, not actual call sites */
/* eslint-disable rulesdir/no-api-in-views -- this test asserts on the mocked API.makeRequestWithSideEffects pipeline; it is not a view */

import {signInWithCredential, updateProfile} from 'firebase/auth';
import type {Auth, AuthCredential} from 'firebase/auth';
import Onyx from 'react-native-onyx';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import HttpsError from '@libs/Errors/HttpsError';
import ONYXKEYS from '@src/ONYXKEYS';
import * as Session from '@userActions/Session';
import * as UserActions from '@userActions/User';

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

// The temporary non-200-resolution diagnostics check the environment before
// showing an alert; report "production" so no Alert fires during tests.
jest.mock('@libs/Environment/Environment', () => ({
  isProduction: jest.fn(() => Promise.resolve(true)),
}));

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

// Replace the whole Firebase Auth surface User.ts imports — only the two calls
// exercised by signInWithOAuth need real behavior; the rest must merely exist.
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

// provisionUser routes through API.makeRequestWithSideEffects; control it to
// simulate the brand-new (resolve) vs returning (409 reject) server outcomes.
jest.mock('@libs/API', () => ({
  makeRequestWithSideEffects: jest.fn(),
  write: jest.fn(),
  read: jest.fn(),
}));

const mockedSignIn = jest.mocked(signInWithCredential);
const mockedUpdateProfile = jest.mocked(updateProfile);
const mockedProvision = jest.mocked(API.makeRequestWithSideEffects);
const mockedClearSignInData = jest.mocked(Session.clearSignInData);
const mockedOnyxUpdate = jest.mocked(Onyx.update);

const fakeAuth = {} as Auth;
const fakeCredential = {} as AuthCredential;
const fakeUser = {
  uid: 'oauth-uid',
  displayName: null,
  email: 'jane@example.com',
  photoURL: null,
};

describe('signInWithOAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSignIn.mockResolvedValue({
      user: fakeUser,
    } as unknown as Awaited<ReturnType<typeof signInWithCredential>>);
  });

  it('provisions and sets the display name for a brand-new account (no optimistic data)', async () => {
    mockedProvision.mockResolvedValue({jsonCode: 200});

    await UserActions.signInWithOAuth(fakeAuth, fakeCredential, 'Jane Doe');

    expect(mockedSignIn).toHaveBeenCalledWith(fakeAuth, fakeCredential);
    // The speculative OAuth provision must NOT apply optimistic Onyx data: the
    // third arg is an empty options object, not `{optimisticData}`.
    expect(mockedProvision).toHaveBeenCalledWith(
      WRITE_COMMANDS.PROVISION_USER,
      expect.objectContaining({
        profile: {
          display_name: 'Jane Doe',
          photo_url: '',
          username_chosen: false,
        },
      }),
      {},
    );
    expect(mockedUpdateProfile).toHaveBeenCalledWith(fakeUser, {
      displayName: 'Jane Doe',
    });
    expect(mockedClearSignInData).toHaveBeenCalledTimes(1);
  });

  it('seeds the default user data into Onyx for a brand-new account so the redirect is deterministic', async () => {
    mockedProvision.mockResolvedValue({jsonCode: 200});

    await UserActions.signInWithOAuth(fakeAuth, fakeCredential, 'Jane Doe');

    // The OnboardingGuard gates on `userData !== undefined`; without this local
    // write a brand-new OAuth account is stranded on the auth screen on native.
    expect(mockedOnyxUpdate).toHaveBeenCalledTimes(1);
    const updates = mockedOnyxUpdate.mock.calls[0][0];
    const userDataUpdate = updates.find(
      update => update.key === ONYXKEYS.USER_DATA_LIST,
    );
    expect(userDataUpdate?.value).toEqual({
      'oauth-uid': expect.objectContaining({
        profile: {
          display_name: 'Jane Doe',
          photo_url: '',
          username_chosen: false,
        },
      }),
    });
  });

  it('swallows a 409 (returning account) and does not re-set the display name', async () => {
    mockedProvision.mockRejectedValue(
      new HttpsError({message: 'Conflict', status: '409'}),
    );

    await expect(
      UserActions.signInWithOAuth(fakeAuth, fakeCredential, 'Jane Doe'),
    ).resolves.toBeUndefined();

    expect(mockedProvision).toHaveBeenCalledTimes(1);
    // A returning user already has their Firebase Auth profile — must not be touched.
    expect(mockedUpdateProfile).not.toHaveBeenCalled();
    // Their real Onyx data must NOT be clobbered with brand-new defaults.
    expect(mockedOnyxUpdate).not.toHaveBeenCalled();
    // Sign-in still proceeds.
    expect(mockedClearSignInData).toHaveBeenCalledTimes(1);
  });

  it('does NOT seed when provisioning resolves with a non-200 envelope (swallowed-rejection regression)', async () => {
    // Field repro (2026-06-11, dev): an already-provisioned account was seeded
    // with new-account defaults after the server returned a real HTTP 409 —
    // i.e. some layer resolved the rejection. Resolution alone must therefore
    // never trigger the seed; only the server's positive `jsonCode: 200`
    // creation signal may.
    mockedProvision.mockResolvedValue({jsonCode: 409});

    await expect(
      UserActions.signInWithOAuth(fakeAuth, fakeCredential, 'Jane Doe'),
    ).resolves.toBeUndefined();

    expect(mockedOnyxUpdate).not.toHaveBeenCalled();
    expect(mockedUpdateProfile).not.toHaveBeenCalled();
    // Sign-in still proceeds — the account exists; this is a returning user.
    expect(mockedClearSignInData).toHaveBeenCalledTimes(1);
  });

  it('does NOT seed when provisioning resolves with no envelope at all', async () => {
    // `makeRequestWithSideEffects` can resolve `undefined` (e.g. the update
    // was already applied via Pusher). Without the positive creation signal
    // the seed must be skipped — the Pusher/openApp data is authoritative.
    mockedProvision.mockResolvedValue(undefined);

    await expect(
      UserActions.signInWithOAuth(fakeAuth, fakeCredential, 'Jane Doe'),
    ).resolves.toBeUndefined();

    expect(mockedOnyxUpdate).not.toHaveBeenCalled();
    expect(mockedUpdateProfile).not.toHaveBeenCalled();
    expect(mockedClearSignInData).toHaveBeenCalledTimes(1);
  });

  it('propagates a non-409 HttpsError and does not complete sign-in', async () => {
    mockedProvision.mockRejectedValue(
      new HttpsError({message: 'Server error', status: '500'}),
    );

    await expect(
      UserActions.signInWithOAuth(fakeAuth, fakeCredential, 'Jane Doe'),
    ).rejects.toThrow('Server error');

    expect(mockedClearSignInData).not.toHaveBeenCalled();
  });

  it('propagates a generic (non-HttpsError) failure', async () => {
    mockedProvision.mockRejectedValue(new Error('network down'));

    await expect(
      UserActions.signInWithOAuth(fakeAuth, fakeCredential, 'Jane Doe'),
    ).rejects.toThrow('network down');

    expect(mockedClearSignInData).not.toHaveBeenCalled();
  });
});
