/**
 * An invite link opened while signed out, kept so the "Add friend" screen can
 * reopen after sign-in and onboarding. Cleared once it is resumed, when it
 * expires, and on sign-out.
 */
type PendingFriendInvite = {
  /** The invite code from the link */
  code: string;

  /** When the link was opened (ms since epoch), used to expire stale codes */
  createdAt: number;
};

export default PendingFriendInvite;
