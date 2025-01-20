import {createMockDatabase} from '../utils/mockDatabase';

describe('MockDatabase', () => {
  it('Should create a mock database', () => {
    const db = createMockDatabase();
    expect(db).toBeTruthy();
  });
});
