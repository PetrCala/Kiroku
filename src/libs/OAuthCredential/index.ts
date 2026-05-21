import type {AuthCredential} from 'firebase/auth';

type GetOAuthCredential = () => Promise<AuthCredential | null>;

// OAuth credential fetching is not supported on web.
// Used wherever the app needs a fresh AuthCredential for an OAuth provider —
// re-authentication (e.g. account deletion, sensitive setting changes) and
// linking from a signed-in session (Connected Accounts).
const getOAuthCredential: Record<string, GetOAuthCredential> = {};

export {getOAuthCredential};
export type {GetOAuthCredential};
