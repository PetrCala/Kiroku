import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';

/**
 * Feedback + bug-report writes, cut over from direct Firebase RTDB writes
 * (`src/database/feedback.ts`) to kiroku-api `API.write` calls. The server owns
 * the generated id, `submit_time`, and `user_id` (derived from the caller's
 * Firebase ID token), so callers pass only the free-text body. The feedback/bug
 * collections are admin-only and fetched on demand, so the server route's
 * `onyxData` is empty — there is nothing to optimistically write.
 */

function submitFeedback(text: string) {
  API.write(WRITE_COMMANDS.SUBMIT_FEEDBACK, {text});
}

function reportABug(text: string) {
  API.write(WRITE_COMMANDS.REPORT_BUG, {text});
}

export {submitFeedback, reportABug};
