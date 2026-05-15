import appleAuth, {
  AppleButton,
} from '@invertase/react-native-apple-authentication';
import type {
  AppleError,
  AppleRequestResponse,
} from '@invertase/react-native-apple-authentication';
import * as Crypto from 'expo-crypto';
import {OAuthProvider} from 'firebase/auth';
import React from 'react';
import {useFirebase} from '@context/global/FirebaseContext';
import Log from '@libs/Log';
import * as User from '@userActions/User';

type AppleSignInProps = {
  onPress?: () => void;
};

type AppleSignInResult = {
  response: AppleRequestResponse;
  rawNonce: string;
};

/**
 * Generates a cryptographically random nonce and its SHA-256 hash.
 * Firebase requires the raw nonce to verify the hashed nonce claim Apple embeds
 * in the identity token — without it, signInWithCredential rejects the credential.
 */
async function generateNonce(): Promise<{raw: string; hashed: string}> {
  const bytes = Crypto.getRandomBytes(32);
  const raw = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const hashed = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    raw,
  );
  return {raw, hashed};
}

/**
 * Performs the native Apple Sign In request and validates the credential state.
 * Returns the raw response (identityToken + fullName) plus the raw nonce that
 * must be forwarded to Firebase, or null on failure.
 */
async function appleSignInRequest(): Promise<AppleSignInResult | null> {
  const {raw: rawNonce, hashed: hashedNonce} = await generateNonce();

  const response = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    // FULL_NAME must come first — see https://github.com/invertase/react-native-apple-authentication/issues/293
    requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
    nonce: hashedNonce,
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
function AppleSignIn({onPress = () => {}}: AppleSignInProps) {
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
