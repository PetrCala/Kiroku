import appleAuth, {
  AppleButton,
} from '@invertase/react-native-apple-authentication';
import type {
  AppleError,
  AppleRequestResponse,
} from '@invertase/react-native-apple-authentication';
import {getRandomBytes} from 'expo-crypto';
import {OAuthProvider} from 'firebase/auth';
import React from 'react';
import {useFirebase} from '@context/global/FirebaseContext';
import * as ErrorUtils from '@libs/ErrorUtils';
import Log from '@libs/Log';
import * as User from '@userActions/User';

type AppleSignInProps = {
  onPress?: () => void;
  onError?: (message: string) => void;
};

type AppleSignInResult = {
  response: AppleRequestResponse;
  rawNonce: string;
};

function generateRawNonce(): string {
  const bytes = getRandomBytes(32);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Performs the native Apple Sign In request and validates the credential state.
 * Returns the raw response (identityToken + fullName) plus the raw nonce that
 * must be forwarded to Firebase, or null on failure.
 */
async function appleSignInRequest(): Promise<AppleSignInResult | null> {
  const rawNonce = generateRawNonce();

  const response = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    // FULL_NAME must come first — see https://github.com/invertase/react-native-apple-authentication/issues/293
    requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
    // The library SHA-256 hashes this before passing to Apple — pass raw, NOT pre-hashed.
    // See node_modules/@invertase/react-native-apple-authentication/ios/RNAppleAuthentication/RNAppleAuthModule.m
    nonce: rawNonce,
  });

  const credentialState = await appleAuth.getCredentialStateForUser(
    response.user,
  );
  if (credentialState !== appleAuth.State.AUTHORIZED) {
    Log.alert('[Apple Sign In] Authentication failed. Original response: ', {
      response,
    });
    return null;
  }

  return {response, rawNonce};
}

/**
 * Apple Sign In button for iOS.
 * Uses @invertase/react-native-apple-authentication to perform the native sign-in request,
 * then passes the resulting identity token to Firebase via OAuthProvider.
 */
function AppleSignIn({
  onPress = () => {},
  onError = () => {},
}: AppleSignInProps) {
  const {auth, db} = useFirebase();

  const handleSignIn = async () => {
    try {
      const result = await appleSignInRequest();
      if (!result) {
        return;
      }

      const {response, rawNonce} = result;
      const {identityToken, fullName} = response;
      // Apple only provides the full name on the very first sign-in
      const displayName =
        [fullName?.givenName, fullName?.familyName].filter(Boolean).join(' ') ||
        null;

      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: identityToken ?? '',
        rawNonce,
      });

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
      onError(ErrorUtils.getAppError(undefined, error).message);
    }
  };

  return (
    <AppleButton
      buttonStyle={AppleButton.Style.BLACK}
      buttonType={AppleButton.Type.SIGN_IN}
      cornerRadius={8}
      style={{height: 48, width: '100%'}}
      onPress={() => {
        handleSignIn();
      }}
    />
  );
}

export default AppleSignIn;
export type {AppleSignInProps};
