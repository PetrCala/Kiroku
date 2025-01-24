import * as crypto from 'crypto';
import {
  randBoolean,
  randEmail,
  randPassword,
  randPastDate,
  randUserName,
} from '@ngneat/falso';
import {randUserID} from './rand';

/** A custom type representing a mock firebase auth user account */
type FbUserAccount = {
  localId: string;
  email: string;
  emailVerified: boolean;
  passwordHash: string;
  salt: string;
  displayName: string;
  photoUrl?: string;
  lastSignedInAt: string;
  createdAt: string;
  disabled?: boolean;
  providerUserInfo: string[];
};

type RandEmailsParams = {
  /** Number of emails to create */
  length?: number;
};
/**
 * Generates an array of random passwords
 *
 * @example
 * randPasswords({length: 10})
 */
function randEmails({length = 50}: RandEmailsParams = {}): string[] {
  return Array.from({length}, () => randEmail());
}

type RandPasswordsParams = {
  /** Number of passwords to create */
  length?: number;
};

/**
 * Generates an array of random passwords
 *
 * @example
 * randPasswords({length: 10})
 */
function randPasswords({length = 50}: RandPasswordsParams = {}): string[] {
  return Array.from({length}, () => randPassword());
}

type FirebasePasswordHash = {
  /** The password hash */
  passwordHash: string;

  /** The password salt */
  salt: string;
};

/** Returns a hashed Firebase password object */
function hashFirebasePassword(password: string): FirebasePasswordHash {
  const salt = crypto.randomBytes(16).toString('base64');
  const hash = crypto.pbkdf2Sync(
    password,
    Buffer.from(salt, 'base64'),
    100000,
    64,
    'sha512',
  );
  const passwordHash = hash.toString('base64');
  return {
    passwordHash,
    salt,
  };
}

type RandUserAccountParams = {
  /** User email */
  email?: string;

  /** User password */
  password?: string;

  /** Url of the user's photo */
  photoUrl?: string;
};

/**
 * Generate a random user account that can be used for Firebase Auth imports
 *
 * @example
 *
 * randUserAccount({email: "custom-user@unicornland.net"})
 */
function randUserAccount({
  email,
  password,
  photoUrl,
}: RandUserAccountParams = {}): FbUserAccount {
  const fbHash = hashFirebasePassword(password ?? randPassword());

  return {
    localId: randUserID(),
    email: email ?? randEmail(),
    emailVerified: randBoolean(),
    passwordHash: fbHash.passwordHash,
    salt: fbHash.salt,
    displayName: randUserName(),
    photoUrl,
    lastSignedInAt: randPastDate().getTime().toString(),
    createdAt: randPastDate().getTime().toString(),
    disabled: false,
    providerUserInfo: [],
  };
}

type RandUserAccountsParams = {
  /** Number of accounts to generate */
  length?: number;

  /** An array of user emails to use. Must have the same length as 'length'. */
  emails?: string[];

  /** An array of passwords to use. Must have the same length as 'length'. */
  passwords?: string[];
};

/**
 * Generate an array of firebase user accounts
 *
 * @example
 *
 * randUserAccounts({length: 10})
 *
 */
function randUserAccounts({
  length,
  emails,
  passwords,
}: RandUserAccountsParams = {}): FbUserAccount[] {
  let n: number;
  switch (true) {
    case !!length:
      n = length;
      break;
    case !!emails:
      n = emails.length;
      break;
    case !!passwords:
      n = passwords.length;
      break;
    default:
      n = 50;
      break;
  }

  const fbEmails = emails ?? randEmails({length: n});
  const fbPasswords = passwords ?? randPasswords({length: n});

  if (fbEmails.length !== n || fbPasswords.length !== n) {
    throw new Error(
      `Invalid input. Ensure all input objects are of the same length.`,
    );
  }
  return Array.from({length: n}, (_, idx) =>
    randUserAccount({email: fbEmails[idx], password: fbPasswords[idx]}),
  );
}

/** A model for the firebase auth emulator accounts.json */
type EmulatorAuth = {
  /** Kind of the auth collection */
  kind: string;

  /** An array of users */
  users: FbUserAccount[];
};

/**
 * Generate a mock firebase auth emulator 'accounts.json' object.
 *
 * @description
 * Mimics the parameters from the function for UserAccounts creation.
 * The output of this function can be used as an import object for the firebase auth emulator initiation.
 */
function createMockAuth({
  length,
  emails,
  passwords,
}: RandUserAccountsParams = {}): EmulatorAuth {
  return {
    kind: 'identitytoolkit#DownloadAccountResponse',
    users: randUserAccounts({length, emails, passwords}),
  };
}

export {
  hashFirebasePassword,
  randEmails,
  randPasswords,
  randUserAccount,
  randUserAccounts,
  createMockAuth,
};
export type {EmulatorAuth};
