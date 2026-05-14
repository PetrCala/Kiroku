// Apple Sign In is only supported on iOS.
// Android and Web have no implementation at this time.

type AppleSignInProps = {
  // eslint-disable-next-line react/no-unused-prop-types
  onPress?: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AppleSignIn(_: AppleSignInProps) {
  return null;
}

export default AppleSignIn;
export type {AppleSignInProps};
