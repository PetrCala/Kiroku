/* eslint-disable import/no-import-module-exports */
import fs from 'fs';
import {writeFile} from '../utils/testutils';
import CONFIG from '../utils/integrationConfig';
import {
  createMockAuth,
  randEmails,
  randPasswords,
} from '../utils/firebase/mockAuth';
import type {EmulatorAuth} from '../utils/firebase/mockAuth';
import {MOCK_EMAIL, MOCK_USER_PASSWORD} from '../utils/firebase/static';

describe('MockAuth', () => {
  let auth: EmulatorAuth;

  const length = 50;

  const emails = [...randEmails({length}), ...[MOCK_EMAIL]];
  const passwords = [...randPasswords({length}), ...[MOCK_USER_PASSWORD]];

  beforeAll(() => {
    auth = createMockAuth({
      emails,
      passwords,
    });
  });

  it('Should create a mock auth object', () => {
    expect(auth).toBeTruthy();
  });

  it('Should save the mock auth object to an output file', () => {
    const filePath = CONFIG.OUTPUT_FILE_AUTH;
    writeFile(auth, filePath);
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
