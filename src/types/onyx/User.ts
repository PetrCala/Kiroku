/** Model of user data */
type User = {
  /** Whether we should use the staging version of the secure API server */
  shouldUseStagingServer?: boolean;

  /** Is the user account validated? */
  validated: boolean;

  /** Whether or not the user is on a public domain email account or not */
  isFromPublicDomain: boolean;

  /** error associated with adding a secondary login */
  error?: string;

  /** Whether the form is being submitted */
  loading?: boolean;

  /** Whether the debug mode is currently enabled */
  isDebugModeEnabled?: boolean;
};

export default User;
