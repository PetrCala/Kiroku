/* eslint-disable import/no-import-module-exports */
import {
  createMockAuth,
  randEmails,
  randPasswords,
} from '../utils/firebase/mockAuth';
import type {EmulatorAuth} from '../utils/firebase/mockAuth';

describe('MockAuth', () => {
  let auth: EmulatorAuth;

  const length = 50;
  const emails = randEmails({length});
  const passwords = randPasswords({length});

  beforeAll(() => {
    auth = createMockAuth({
      emails,
      passwords,
    });
  });

  it('Should create a mock auth object', () => {
    expect(auth).toBeTruthy();
  });

  it('Should create the correct number of mock', () => {
    expect(auth.users.length).toEqual(length);
  });

  it('Should assign the correct emails to the mock users', () => {
    const mockUserEmails = auth.users.map(user => user.email);
    expect(emails).toEqual(mockUserEmails);
  });

  it('Should assign unique IDs to all users', () => {
    const mockUserIDs = auth.users.map(user => user.localId);
    const uniqueIds = [...new Set(mockUserIDs)];
    expect(uniqueIds.length).toEqual(length);
  });
});
