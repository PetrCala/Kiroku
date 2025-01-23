import {randUserIDs} from '../utils/rand';
import {randConnections} from '../utils/connections';

describe('randConnections', () => {
  it('throws if userIds array has fewer than 2 elements', () => {
    expect(() => randConnections({userIds: ['onlyOne']})).toThrow(
      'At least two user IDs are required',
    );
  });

  it('creates a symmetrical connections object for multiple users', () => {
    const userIds = randUserIDs({length: 4});
    const connections = randConnections({
      userIds,
      minConnections: 0,
      maxConnections: 3,
    });

    // 1) Check that the returned object has the same number of keys as the length of userIds
    expect(Object.keys(connections)).toHaveLength(userIds.length);

    // 2) Check symmetrical property
    for (const [user, friends] of Object.entries(connections)) {
      for (const friend of friends) {
        // friend should have 'user' in its array
        expect(connections[friend]).toContain(user);
      }
    }
  });

  it('allows some users to have zero connections and others to have multiple', () => {
    const userIds = randUserIDs({length: 5});
    const connections = randConnections({
      userIds,
      minConnections: 0,
      maxConnections: 4,
    });

    // We only check correctness (symmetry). Some might have 0, some up to 4.
    for (const [user, friends] of Object.entries(connections)) {
      for (const friend of friends) {
        expect(connections[friend]).toContain(user);
      }
    }
  });
});
