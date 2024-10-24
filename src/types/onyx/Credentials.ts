import type {UserID} from './OnyxCommon';

type Credentials = {
  /** The email/phone the user logged in with */
  login?: string;

  /** The password the user logged in with */
  password?: string;

  /** The two factor auth code */
  twoFactorAuthCode?: string;

  /** The validate code */
  validateCode?: string;

  /** The auto-generated login. */
  autoGeneratedLogin?: string;

  /** The auto-generated password. */
  autoGeneratedPassword?: string;

  /** The user's ID */
  userID?: UserID;

  /** The user's ID for external integration */
  partnerUserID?: string;

  /** The user's secret for external integration */
  partnerUserSecret?: string;
};

export default Credentials;
