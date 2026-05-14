import appleAuth, {
  AppleButton,
} from '@invertase/react-native-apple-authentication';
import type {AppleError} from '@invertase/react-native-apple-authentication';
import {OAuthProvider} from 'firebase/auth';
import React from 'react';
import {useFirebase} from '@context/global/FirebaseContext';
import Log from '@libs/Log';
import * as User from '@userActions/User';

type AppleSignInProps = {
  onPress?: () => void;
};

/**
 * Apple Sign In button for iOS.
 * Uses @invertase/react-native-apple-authentication to perform the native sign-in request,
 * then passes the resulting identity token to Firebase via OAuthProvider.
 */
function AppleSignIn({onPress = () => {}}: AppleSignInProps) {
  const {auth, db} = useFirebase();

  const handleSignIn = async () => {
    try {
      const response = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        // FULL_NAME must come first — see https://github.com/invertase/react-native-apple-authentication/issues/293
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });

      const credentialState = await appleAuth.getCredentialStateForUser(
        response.user,
      );
      if (credentialState !== appleAuth.State.AUTHORIZED) {
        Log.alert(
          '[Apple Sign In] Authentication failed. Original response: ',
          {response},
        );
        return;
      }

      const {identityToken, fullName} = response;
      // Apple only provides the full name on the very first sign-in
      const displayName =
        [fullName?.givenName, fullName?.familyName].filter(Boolean).join(' ') ||
        null;

      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({idToken: identityToken ?? ''});

      onPress();
      await User.signInWithOAuth(auth, db, credential, displayName);
    } catch (error: unknown) {
      const e = error as {code?: AppleError};
      if (e.code === appleAuth.Error.CANCELED) {
        return;
      }
      Log.alert(
        '[Apple Sign In] Apple authentication failed',
        error as Record<string, unknown>,
      );
    }
  };

  return (
    <AppleButton
      buttonStyle={AppleButton.Style.WHITE}
      buttonType={AppleButton.Type.SIGN_IN}
      cornerRadius={22}
      style={{height: 44, width: 44}}
      onPress={() => {
        handleSignIn();
      }}
    />
  );
}

export default AppleSignIn;
export type {AppleSignInProps};
