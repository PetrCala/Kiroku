import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';

/**
 * Feedback + bug-report writes, cut over from direct Firebase RTDB writes to
 * kiroku-api `API.write` calls. The server owns
 * the generated id, `submit_time`, and `user_id` (derived from the caller's
 * Firebase ID token), so callers pass only the free-text body. The feedback/bug
 * collections are admin-only and fetched on demand, so the server route's
 * `onyxData` is empty — there is nothing to optimistically write.
 *
 * The admin removes are also empty-`onyxData` writes: the SeeFeedbackScreen /
 * SeeBugsScreen lists are still hydrated by a Firebase read listener (read
 * cutover is #809), so the server-side delete drives the list refresh and no
 * optimistic Onyx data is needed. Authority is the caller's admin claim,
 * enforced server-side.
 */

function submitFeedback(text: string) {
  API.write(WRITE_COMMANDS.SUBMIT_FEEDBACK, {text});
}

function reportABug(text: string) {
  API.write(WRITE_COMMANDS.REPORT_BUG, {text});
}

function removeFeedback(feedbackId: string) {
  API.write(WRITE_COMMANDS.REMOVE_FEEDBACK, {feedbackId});
}

function removeBug(bugId: string) {
  API.write(WRITE_COMMANDS.REMOVE_BUG, {bugId});
}

export {submitFeedback, reportABug, removeFeedback, removeBug};
