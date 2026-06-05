import type {UserID} from '@src/types/onyx/OnyxCommon';

/** Params for the privacy-enforced friend-preferences read (`GET /v1/users/:uid/preferences`). */
type OpenFriendPreferencesParams = {
  /** The owner whose rendering preferences are being read. Authority is the Bearer token. */
  userID: UserID;
};

export default OpenFriendPreferencesParams;
