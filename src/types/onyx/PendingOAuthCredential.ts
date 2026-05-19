/**
 * Raw OAuth sign-in materials stashed when Firebase reports that the email
 * already belongs to an existing email/password account
 * (`auth/account-exists-with-different-credential`). The collision-resolution
 * modal reads this to prompt the user for their existing password, then
 * reconstructs the credential and calls `linkWithCredential`.
 *
 * Stored in Onyx for reactivity, but treated as ephemeral: cleared on
 * successful link, on user cancel, and on `cleanupSession()`. The idToken is
 * short-lived, so a stale stash on disk is not exploitable for long.
 */
type PendingOAuthCredential = {
  /** Which OAuth provider produced the credential */
  providerId: 'apple.com' | 'google.com';

  /** Email of the existing account — used as the login for the password prompt */
  email: string;

  /** Apple/Google identity token; required to reconstruct the credential */
  idToken: string;

  /** Raw nonce — required to reconstruct Apple credentials; absent for Google */
  rawNonce?: string;

  /** Best-effort display name captured from the OAuth provider response */
  displayName?: string | null;
};

export default PendingOAuthCredential;
