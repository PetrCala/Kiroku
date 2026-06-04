import type {Database} from 'firebase/database';
import {ref, update} from 'firebase/database';
import DBPATHS from '@src/DBPATHS';

const feedbackItemRef = DBPATHS.FEEDBACK_FEEDBACK_ID;
const bugItemRef = DBPATHS.BUGS_BUG_ID;

/**
 * Remove a feedback item from the database
 *
 * @param db The database object
 * @param feedbackKey Feedback ID
 */
async function removeFeedback(
  db: Database,
  feedbackKey: string,
): Promise<void> {
  const updates: Record<string, null> = {};
  updates[feedbackItemRef.getRoute(feedbackKey)] = null;
  await update(ref(db), updates);
}

/**
 * Remove a bug item from the database
 *
 * @param db The database object
 * @param bugKey bug ID
 */
async function removeBug(db: Database, bugKey: string): Promise<void> {
  const updates: Record<string, null> = {};
  updates[bugItemRef.getRoute(bugKey)] = null;
  await update(ref(db), updates);
}

export {removeFeedback, removeBug};
