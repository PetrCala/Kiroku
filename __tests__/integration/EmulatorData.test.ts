/* eslint-disable import/no-import-module-exports */
import fs from 'fs';
import type {DatabaseProps} from '@src/types/onyx';
import {writeFile} from '../utils/testutils';
import CONFIG from '../utils/integrationConfig';
import {
  createMockAuth,
  randEmails,
  randPasswords,
} from '../utils/firebase/mockAuth';
import {MOCK_EMAIL, MOCK_USER_PASSWORD} from '../utils/firebase/static';
import {createMockDatabase} from '../utils/firebase/mockDatabase';
import type {EmulatorAuth} from '../utils/firebase/mockAuth';

describe('MockEmulatorData', () => {
  let auth: EmulatorAuth;
  let db: DatabaseProps;

  const length = 50;

  const emails = [...randEmails({length}), ...[MOCK_EMAIL]];
  const passwords = [...randPasswords({length}), ...[MOCK_USER_PASSWORD]];

  beforeAll(() => {
    auth = createMockAuth({
      emails,
      passwords,
    });
    const userIDs = auth.users.map(user => user.localId);
    db = createMockDatabase({userIDs});
  });

  it('Should save the mock auth object to an output file', () => {
    const filePath = CONFIG.OUTPUT_FILE_AUTH;
    writeFile(auth, filePath);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('Should save the mock database to an output file', () => {
    const filePath = CONFIG.OUTPUT_FILE_DB;
    writeFile(db, filePath);
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
