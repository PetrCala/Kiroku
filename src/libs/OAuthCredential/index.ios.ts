import appleAuth from '@invertase/react-native-apple-authentication';
import type {AppleError} from '@invertase/react-native-apple-authentication';
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

async function getAppleCredential(): Promise<AuthCredential | null> {
  try {
    const response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
    });
    const credentialState = await appleAuth.getCredentialStateForUser(
      response.user,
    );
    if (credentialState !== appleAuth.State.AUTHORIZED) {
      return null;
    }
    const provider = new OAuthProvider('apple.com');
    return provider.credential({idToken: response.identityToken ?? ''});
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
