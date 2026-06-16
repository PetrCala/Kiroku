type AppleSignInResponse = {
  authorization: {
    code: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    id_token: string;
    state?: string;
  };
  // Apple only sends the user object on the very first sign-in.
  user?: {
    name?: {
      firstName?: string;
      lastName?: string;
    };
    email?: string;
  };
};

type AppleIDInitConfig = {
  clientId: string;
  redirectURI: string;
  scope?: string;
  state?: string;
  nonce?: string;
  usePopup?: boolean;
};

type AppleID = {
  auth: {
    init: (config: AppleIDInitConfig) => void;
    signIn: () => Promise<AppleSignInResponse>;
  };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    AppleID?: AppleID;
  }
}

export type {AppleID, AppleIDInitConfig, AppleSignInResponse};
