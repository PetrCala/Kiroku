import HttpsError from '@libs/Errors/HttpsError';
import CONST from '@src/CONST';
import type {PendingFriendInvite} from '@src/types/onyx';

/**
 * Mirrors kiroku-api `lib/inviteCode.ts`: ten characters, lowercase letters and
 * digits without the look-alikes 0, 1, l and o. Codes are matched
 * case-insensitively, so a link retyped with capitals still works.
 */
const INVITE_CODE_PATTERN = /^[2-9a-kmnp-z]{10}$/;

/** How an invite call failed, as far as the UI cares. */
type InviteErrorKind = 'invalid' | 'ownInvite' | 'unavailable' | 'failed';

/** The code from a URL, trimmed and lowercased, or undefined if it can't be one. */
function normalizeInviteCode(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const code = raw.trim().toLowerCase();
  return INVITE_CODE_PATTERN.test(code) ? code : undefined;
}

/** The shareable link for a code (also what the QR code encodes). */
function getInviteLink(code: string): string {
  return `${CONST.FRIEND_INVITE.LINK_BASE_URL}${code}`;
}

/** Whether a link opened while signed out is still worth resuming. */
function isPendingInviteFresh(
  pendingInvite: PendingFriendInvite | undefined,
  now: number = Date.now(),
): pendingInvite is PendingFriendInvite {
  if (!pendingInvite?.code) {
    return false;
  }
  const age = now - pendingInvite.createdAt;
  return age >= 0 && age < CONST.FRIEND_INVITE.PENDING_TTL_MS;
}

/**
 * Map a failed invite request to what the screen shows. Only the HTTP status
 * survives a failed request (the client drops error bodies), which is exactly
 * what the server's contract encodes: 404 for any unusable code, 400 for your
 * own code, and a neutral 403 when the two users can't be friends.
 */
function getInviteErrorKind(error: unknown): InviteErrorKind {
  if (!(error instanceof HttpsError)) {
    return 'failed';
  }
  switch (error.status) {
    case String(CONST.HTTP_STATUS.NOT_FOUND):
      return 'invalid';
    case String(CONST.HTTP_STATUS.BAD_REQUEST):
      return 'ownInvite';
    case String(CONST.HTTP_STATUS.FORBIDDEN):
      return 'unavailable';
    default:
      return 'failed';
  }
}

export {
  getInviteErrorKind,
  getInviteLink,
  isPendingInviteFresh,
  normalizeInviteCode,
};
export type {InviteErrorKind};
