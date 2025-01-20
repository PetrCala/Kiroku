/* eslint-disable import/no-import-module-exports */
import fs from 'fs';
import path from 'path';
import type {DatabaseProps} from '@src/types/onyx';
import {createMockDatabase} from '../utils/mockDatabase';
import CONFIG from './config';

const writeDbFile = (db: DatabaseProps) => {
  const dbDir = path.dirname(CONFIG.OUTPUT_FILE_DB);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
  }

  fs.writeFileSync(CONFIG.OUTPUT_FILE_DB, JSON.stringify(db));
};

describe('MockDatabase', () => {
  let db: DatabaseProps;

  beforeAll(() => {
    db = createMockDatabase();
  });

  it('Should create a mock database', () => {
    expect(db).toBeTruthy();
  });

  it('Should save the mock database to an output file', () => {
    writeDbFile(db);

    const filePath = CONFIG.OUTPUT_FILE_DB;
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
