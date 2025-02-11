/* eslint-disable import/no-import-module-exports */
import type {DatabaseProps} from '@src/types/onyx';
import {createMockDatabase} from '../utils/firebase/mockDatabase';

describe('MockDatabase', () => {
  let db: DatabaseProps;

  beforeAll(() => {
    db = createMockDatabase();
  });

  it('Should create a mock database', () => {
    expect(db).toBeTruthy();
  });
});
