import type {Timestamp} from '@src/types/onyx/OnyxCommon';

/** Get a random timestamp between two other timestamps. */
function getRandomTimestamp(
  startTimestamp: Timestamp,
  endTimestamp: Timestamp,
): Timestamp {
  if (startTimestamp > endTimestamp) {
    throw new Error(
      'Start timestamp must be less than or equal to end timestamp.',
    );
  }

  return (
    Math.floor(Math.random() * (endTimestamp - startTimestamp + 1)) +
    startTimestamp
  );
}

export {
  // eslint-disable-next-line import/prefer-default-export
  getRandomTimestamp,
};
