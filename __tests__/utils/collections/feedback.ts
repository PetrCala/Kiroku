import {rand, randParagraph, randPastDate} from '@ngneat/falso';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Feedback, FeedbackList} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import {randUserID, randUserIDs} from './userAccount';
import {randDbKey} from '../rand';
import createCollection from './createCollection';

type RandFeedbackParams = {
  /** ID of the user that submitted the feedback */
  userID?: UserID;
};

/**
 * Generate a random feedback object
 *
 * @example
 *
 * randFeedback()
 */
function randFeedback({userID}: RandFeedbackParams): Feedback {
  return {
    submit_time: randPastDate().getTime(),
    text: randParagraph(),
    user_id: userID ?? randUserID(),
  };
}

type RandFeedbackListParams = {
  /** An array of user IDs to generate the feedback from */
  userIDs?: UserID[];

  /** How many feedback objects to generate */
  length?: number;
};

/**
 * Generate a collection of feedback objects
 *
 * @example
 *
 * randFeedbackList({length: 20})
 */
function randFeedbackList({
  userIDs,
  length = 20,
}: RandFeedbackListParams): FeedbackList {
  const listLength = Math.max(length, 1);
  const defaultIdsLength = Math.max(Math.floor(listLength / 5), 1);
  const ids = userIDs ?? randUserIDs({length: defaultIdsLength});

  return createCollection<Feedback>(
    () => `${ONYXKEYS.COLLECTION.FEEDBACK}${randDbKey()}`,
    () => randFeedback({userID: rand(ids)}),
    length,
  );
}

export {randFeedback, randFeedbackList};
