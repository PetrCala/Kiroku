import {
  GoogleSignin,
  GoogleSigninButton,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {GoogleAuthProvider} from 'firebase/auth';
import React from 'react';
import {useFirebase} from '@context/global/FirebaseContext';
import Log from '@libs/Log';
import * as User from '@userActions/User';
import CONFIG from '@src/CONFIG';

type GoogleSignInProps = {
  onPress?: () => void;
};

/**
 * Google Sign In button for iOS and Android.
 * Uses @react-native-google-signin/google-signin to perform the native sign-in,
 * then passes the resulting ID token to Firebase via GoogleAuthProvider.
 */
function GoogleSignIn({onPress = () => {}}: GoogleSignInProps) {
  const {auth, db} = useFirebase();

  const handleSignIn = async () => {
    try {
      GoogleSignin.configure({
        webClientId: CONFIG.GOOGLE_SIGN_IN.WEB_CLIENT_ID,
        iosClientId: CONFIG.GOOGLE_SIGN_IN.IOS_CLIENT_ID,
        offlineAccess: false,
      });

      // Sign out before signing in to always show the account picker
      await GoogleSignin.signOut();

      const response = await GoogleSignin.signIn();
      const {idToken} = response;

      if (!idToken) {
        Log.alert('[Google Sign In] No ID token received from Google');
        return;
      }

      const credential = GoogleAuthProvider.credential(idToken);
      onPress();
      await User.signInWithOAuth(auth, db, credential);
    } catch (error: unknown) {
      const e = error as {code?: string; message?: string};
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }
      Log.alert(
        `[Google Sign In] Error code: ${e.code ?? 'unknown'}. ${e.message ?? ''}`,
        {},
        false,
      );
    }
  };

  return (
    <GoogleSigninButton
      color={GoogleSigninButton.Color.Light}
      size={GoogleSigninButton.Size.Icon}
      onPress={() => {
        handleSignIn();
      }}
    />
  );
}

export default GoogleSignIn;
export type {GoogleSignInProps};
