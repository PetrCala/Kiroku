import type {Request} from 'express';
import type {DecodedIdToken} from 'firebase-admin/auth';

type AuthenticatedRequest = Request & {
  /** Authenticated user ID token */
  user?: DecodedIdToken;
};

export type {AuthenticatedRequest};

