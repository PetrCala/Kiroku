describe('updates utils', () => {
  test('pathsConflict detects ancestor/descendant conflicts', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {pathsConflict} = require('../../packages/kiroku-common/src/database/updates');
    expect(pathsConflict('a/b', 'a/b/c')).toBe(true);
    expect(pathsConflict('a/b/c', 'a/b')).toBe(true);
    expect(pathsConflict('a/b', 'a/b')).toBe(false);
    expect(pathsConflict('a/b', 'a/c')).toBe(false);
  });

  test('removeOverlappingUpdates removes children of nullified parent', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {removeOverlappingUpdates} = require('../../packages/kiroku-common/src/database/updates');
    const input = {
      'users/u1/profile': null,
      'users/u1/profile/name': 'Alice',
      'users/u1/profile/photo_url': 'url',
      'users/u1/timezone': 'UTC',
    };
    const cleaned = removeOverlappingUpdates(input);
    expect(cleaned).toEqual({
      'users/u1/profile': null,
      'users/u1/timezone': 'UTC',
    });
  });
});

