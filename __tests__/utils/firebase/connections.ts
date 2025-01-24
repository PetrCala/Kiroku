import {randNumber} from '@ngneat/falso';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import {randUserIDs} from './rand';

/**
An object where each key is a user ID and
each value is an array of user IDs that key is connected to.
 */
type Connections = Record<UserID, UserID[]>;

type RandConnectionsParams = {
  /* The list of user IDs */
  userIds?: UserID[];

  /* The minimum number of desired connections (inclusive) */
  minConnections?: number;

  /* The maximum number of desired connections (inclusive) */
  maxConnections?: number;
};

/**
 * Creates mutual connections between the given user IDs.
 *
 * @param userIds - The list of user IDs
 * @param minConnections - The minimum number of desired connections (inclusive)
 * @param maxConnections - The maximum number of desired connections (inclusive)
 * @returns An object where each key is a user ID and each value is an array of IDs (friends/connections).
 * @example
 *
 * randConnections({})
 *
 * @example
 *
 * randConnections({userIds: ['abc', 'def', 'ghi'], maxConnections: 10})
 */
function randConnections({
  userIds = randUserIDs(),
  minConnections,
  maxConnections,
}: RandConnectionsParams): Connections {
  if (userIds.length < 2) {
    throw new Error('At least two user IDs are required to form connections.');
  }

  // 1) Decide how many connections each user should *try* to have
  const targetConnections: Record<UserID, number> = {};
  for (const userId of userIds) {
    targetConnections[userId] = randNumber({
      min: minConnections ?? 0,
      max: maxConnections ?? Math.max(Math.floor(userIds.length / 5), 1),
    });
  }

  // 2) Initialize the result with empty arrays
  const connections: Connections = {};
  for (const userId of userIds) {
    connections[userId] = [];
  }

  // 3) Shuffle user IDs to randomize the order in which we assign connections
  const shuffled = [...userIds].sort(() => Math.random() - 0.5);

  // 4) Try to satisfy each user's target
  for (const userId of shuffled) {
    // while this user hasn't reached its desired number of connections
    while (connections[userId].length < targetConnections[userId]) {
      // Potential candidates are those:
      //  - not the user itself
      //  - haven't reached their own target
      //  - and not already connected to this user
      const possiblePartners = userIds.filter(otherId => {
        return (
          otherId !== userId &&
          connections[otherId].length < targetConnections[otherId] &&
          !connections[userId].includes(otherId)
        );
      });

      // if there's no one left to connect with, break
      if (possiblePartners.length === 0) {
        break;
      }

      // pick a random partner from the possible partners
      const partner =
        possiblePartners[
          randNumber({min: 0, max: possiblePartners.length - 1})
        ];

      // connect both ways (mutual)
      connections[userId].push(partner);
      connections[partner].push(userId);
    }
  }

  return connections;
}

export {
  // eslint-disable-next-line import/prefer-default-export
  randConnections,
};
