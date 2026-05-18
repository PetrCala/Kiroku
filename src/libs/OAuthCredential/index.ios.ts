import appleAuth from '@invertase/react-native-apple-authentication';
import type {AppleError} from '@invertase/react-native-apple-authentication';
import * as Crypto from 'expo-crypto';
import {GoogleAuthProvider, OAuthProvider} from 'firebase/auth';
import type {AuthCredential} from 'firebase/auth';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import Log from '@libs/Log';
import CONFIG from '@src/CONFIG';
import type {GetOAuthCredential} from './index';

async function getGoogleCredential(): Promise<AuthCredential | null> {
  GoogleSignin.configure({
    webClientId: CONFIG.GOOGLE_SIGN_IN.WEB_CLIENT_ID,
    iosClientId: CONFIG.GOOGLE_SIGN_IN.IOS_CLIENT_ID,
    offlineAccess: false,
  });
  await GoogleSignin.signOut();
  try {
    const response = await GoogleSignin.signIn();
    if (!response.idToken) {
      return null;
    }
    return GoogleAuthProvider.credential(response.idToken);
  } catch (error: unknown) {
    const e = error as {code?: string};
    if (e.code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    Log.warn('[OAuthCredential] Google reauthentication failed', {error});
    throw error;
  }
}

/**
 * Generates a cryptographically random nonce and its SHA-256 hash.
 * Firebase requires the raw nonce to verify the hashed nonce claim Apple
 * embeds in the identity token — without it, reauthenticateWithCredential
 * rejects the credential.
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

async function getAppleCredential(): Promise<AuthCredential | null> {
  try {
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
      return null;
    }
    const provider = new OAuthProvider('apple.com');
    return provider.credential({
      idToken: response.identityToken ?? '',
      rawNonce,
    });
  } catch (error: unknown) {
    const e = error as {code?: AppleError};
    if (e.code === appleAuth.Error.CANCELED) {
      return null;
    }
    Log.warn('[OAuthCredential] Apple reauthentication failed', {error});
    throw error;
  }
}

const getOAuthCredentialForDeletion: Record<string, GetOAuthCredential> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'google.com': getGoogleCredential,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'apple.com': getAppleCredential,
};

export {getOAuthCredentialForDeletion};
export type {GetOAuthCredential};
