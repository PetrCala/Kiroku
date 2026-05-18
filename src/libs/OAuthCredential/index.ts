import type {AuthCredential} from 'firebase/auth';

type GetOAuthCredential = () => Promise<AuthCredential | null>;

// OAuth reauthentication is not supported on web.
const getOAuthCredentialForDeletion: Record<string, GetOAuthCredential> = {};

export {getOAuthCredentialForDeletion};
export type {GetOAuthCredential};
