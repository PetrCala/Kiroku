/* eslint-disable import/no-import-module-exports */
import fs from 'fs';
import type {DatabaseProps} from '@src/types/onyx';
import {createMockDatabase} from '../utils/firebase/mockDatabase';
import {writeFile} from '../utils/testutils';
import CONFIG from '../utils/integrationConfig';

describe('MockDatabase', () => {
  let db: DatabaseProps;

  beforeAll(() => {
    db = createMockDatabase();
  });

  it('Should create a mock database', () => {
    expect(db).toBeTruthy();
  });

  it('Should save the mock database to an output file', () => {
    const filePath = CONFIG.OUTPUT_FILE_DB;
    writeFile(db, filePath);
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
