import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {SIDE_EFFECT_REQUEST_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
import Log from '@libs/Log';
import type {Bug, BugList, Feedback, FeedbackList} from '@src/types/onyx';
import ONYXKEYS from '@src/ONYXKEYS';

/**
 * Feedback + bug-report writes and admin reads, cut over from direct Firebase
 * RTDB access to kiroku-api calls. The server owns the generated id,
 * `submit_time`, and `user_id` (derived from the caller's Firebase ID token), so
 * callers pass only the free-text body. The feedback/bug collections are
 * admin-only and fetched on demand, so the write routes' `onyxData` is empty —
 * there is nothing to optimistically write.
 *
 * The admin removes (`removeFeedback` / `removeBug`) optimistically drop the
 * item from `FEEDBACK_LIST` / `BUG_LIST` so the row disappears immediately, and
 * restore it via `failureData` if the server rejects the delete (otherwise only
 * the next fetch would undo the optimistic removal). The caller passes the item
 * it is deleting — already in hand from the rendered list — so the restore needs
 * no separate read. Authority is the caller's admin claim, enforced server-side.
 *
 * The admin reads (`getFeedbackList` / `getBugList`) back the SeeFeedbackScreen /
 * SeeBugsScreen lists. The GET routes return the whole collection as plain JSON
 * (not an `onyxData` envelope), so these actions take the resolved list and
 * `Onyx.set` it under `FEEDBACK_LIST` / `BUG_LIST`; the screens render from Onyx
 * via `useOnyx`. Storing it in Onyx (rather than transient component state) means
 * a slow response still lands safely after the screen has unmounted, and a
 * re-visit renders the cached list instantly while a fresh fetch refreshes it.
 *
 * These reads go through `makeRequestWithSideEffects` (the default
 * `MAKE_REQUEST_WITH_SIDE_EFFECTS` request type, not `READ`), so a non-2xx response
 * (e.g. a 500 or a 401) rejects out of the call — `HttpUtils` throws an `HttpsError`.
 * The screens fire these without a `.catch` (only `.finally`), so that rejection
 * would escape as an unhandled promise rejection and pop the web dev-server red
 * overlay. Each read therefore catches its own failure: it logs and resolves WITHOUT
 * touching the Onyx key, so a transient failure leaves the cached list intact rather
 * than clearing it (which is why we don't simply resolve-undefined-on-error).
 * Part of the #809 realtime cutover.
 */

function submitFeedback(text: string) {
  API.write(WRITE_COMMANDS.SUBMIT_FEEDBACK, {text});
}

function reportABug(text: string) {
  API.write(WRITE_COMMANDS.REPORT_BUG, {text});
}

function removeFeedback(feedbackId: string, feedback: Feedback) {
  const optimisticData: OnyxUpdate[] = [
    {
      onyxMethod: Onyx.METHOD.MERGE,
      key: ONYXKEYS.FEEDBACK_LIST,
      value: {[feedbackId]: null},
    },
  ];
  const failureData: OnyxUpdate[] = [
    {
      onyxMethod: Onyx.METHOD.MERGE,
      key: ONYXKEYS.FEEDBACK_LIST,
      value: {[feedbackId]: feedback},
    },
  ];
  API.write(
    WRITE_COMMANDS.REMOVE_FEEDBACK,
    {feedbackId},
    {optimisticData, failureData},
  );
}

function removeBug(bugId: string, bug: Bug) {
  const optimisticData: OnyxUpdate[] = [
    {
      onyxMethod: Onyx.METHOD.MERGE,
      key: ONYXKEYS.BUG_LIST,
      value: {[bugId]: null},
    },
  ];
  const failureData: OnyxUpdate[] = [
    {
      onyxMethod: Onyx.METHOD.MERGE,
      key: ONYXKEYS.BUG_LIST,
      value: {[bugId]: bug},
    },
  ];
  API.write(WRITE_COMMANDS.REMOVE_BUG, {bugId}, {optimisticData, failureData});
}

function getFeedbackList(): Promise<void> {
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  return API.makeRequestWithSideEffects(
    SIDE_EFFECT_REQUEST_COMMANDS.GET_FEEDBACK_LIST,
    {},
  )
    .then(response => {
      const list = (response as unknown as FeedbackList | undefined) ?? {};
      return Onyx.set(ONYXKEYS.FEEDBACK_LIST, list);
    })
    .catch((error: unknown) => {
      // Swallow the rejection so it doesn't escape as an unhandled promise
      // rejection, and leave FEEDBACK_LIST untouched so a transient failure keeps
      // the cached list instead of clearing it.
      Log.warn('[Feedback] getFeedbackList failed', {error});
    });
}

function getBugList(): Promise<void> {
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  return API.makeRequestWithSideEffects(
    SIDE_EFFECT_REQUEST_COMMANDS.GET_BUG_LIST,
    {},
  )
    .then(response => {
      const list = (response as unknown as BugList | undefined) ?? {};
      return Onyx.set(ONYXKEYS.BUG_LIST, list);
    })
    .catch((error: unknown) => {
      // Swallow the rejection so it doesn't escape as an unhandled promise
      // rejection, and leave BUG_LIST untouched so a transient failure keeps the
      // cached list instead of clearing it.
      Log.warn('[Feedback] getBugList failed', {error});
    });
}

export {
  submitFeedback,
  reportABug,
  removeFeedback,
  removeBug,
  getFeedbackList,
  getBugList,
};
