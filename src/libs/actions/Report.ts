import type {ValueOf} from 'type-fest';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import type CONST from '@src/CONST';

/**
 * Reporting a user is feedback-shaped, not block-shaped: it is additive,
 * server-only, admin-reviewed content (reviewed later via kiroku-cli, #766). The
 * server owns the generated id, `submit_time`, and the reporter id (derived from
 * the caller's Firebase ID token), so the client passes only the reported user,
 * a reason, and an optional free-text description. Like `submitFeedback` /
 * `reportABug` in `Feedback.ts`, this is a fire-and-forget write with no
 * `onyxData` — there is no client-side report collection to optimistically
 * mutate, and the reporter never sees their own submitted reports. The caller
 * surfaces a success confirmation; a dismissible error is raised at the call
 * site (mirroring the block flow) if the write throws synchronously.
 *
 * Reporting is intentionally NOT gated behind the friend-management flow: any
 * viewable profile (friend, friend-of-friend, search result) can be reported, so
 * unlike block this carries no unfriend side effect. Part of the moderation epic
 * (#757) required for App Store Guideline 1.2.
 */

type ReportReason = ValueOf<typeof CONST.REPORT.REASON>;

function reportUser(
  otherUserId: string,
  reason: ReportReason,
  description?: string,
) {
  API.write(WRITE_COMMANDS.REPORT_USER, {otherUserId, reason, description});
}

export {reportUser};
export type {ReportReason};
