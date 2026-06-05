import * as API from '@libs/API';
import {SIDE_EFFECT_REQUEST_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
import type {BugList, FeedbackList} from '@src/types/onyx';

/**
 * Feedback + bug-report writes and admin reads, cut over from direct Firebase
 * RTDB access to kiroku-api calls. The server owns the generated id,
 * `submit_time`, and `user_id` (derived from the caller's Firebase ID token), so
 * callers pass only the free-text body. The feedback/bug collections are
 * admin-only and fetched on demand, so the write routes' `onyxData` is empty —
 * there is nothing to optimistically write.
 *
 * The admin removes are also empty-`onyxData` writes; authority is the caller's
 * admin claim, enforced server-side.
 *
 * The admin reads (`getFeedbackList` / `getBugList`) back the SeeFeedbackScreen /
 * SeeBugsScreen lists. The GET routes return the whole collection as plain JSON
 * (not an `onyxData` envelope), so `makeRequestWithSideEffects` resolves with the
 * list itself and the screens load it into local component state rather than
 * Onyx. Part of the #809 realtime cutover.
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

function getFeedbackList(): Promise<FeedbackList> {
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  return API.makeRequestWithSideEffects(
    SIDE_EFFECT_REQUEST_COMMANDS.GET_FEEDBACK_LIST,
    {},
  ).then(response => (response as unknown as FeedbackList | undefined) ?? {});
}

function getBugList(): Promise<BugList> {
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  return API.makeRequestWithSideEffects(
    SIDE_EFFECT_REQUEST_COMMANDS.GET_BUG_LIST,
    {},
  ).then(response => (response as unknown as BugList | undefined) ?? {});
}

export {
  submitFeedback,
  reportABug,
  removeFeedback,
  removeBug,
  getFeedbackList,
  getBugList,
};
