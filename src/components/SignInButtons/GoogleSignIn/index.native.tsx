import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {GoogleAuthProvider} from 'firebase/auth';
import React from 'react';
import {StyleSheet, View} from 'react-native';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import Log from '@libs/Log';
import * as User from '@userActions/User';
import CONFIG from '@src/CONFIG';

type GoogleSignInProps = {
  onPress?: () => void;
};

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: '#1F1F1F',
    fontSize: 17,
    fontWeight: '600',
  },
});

/**
 * Performs the native Google Sign In request and returns the resulting idToken.
 * Returns null if the user cancels or no token is issued.
 */
async function googleSignInRequest(): Promise<string | null> {
  GoogleSignin.configure({
    webClientId: CONFIG.GOOGLE_SIGN_IN.WEB_CLIENT_ID,
    iosClientId: CONFIG.GOOGLE_SIGN_IN.IOS_CLIENT_ID,
    offlineAccess: false,
  });

  // Sign out before signing in to always show the account picker
  await GoogleSignin.signOut();

  const response = await GoogleSignin.signIn();
  return response.idToken ?? null;
}

/**
 * Google Sign In button for iOS and Android.
 * Uses @react-native-google-signin/google-signin to perform the native sign-in,
 * then passes the resulting ID token to Firebase via GoogleAuthProvider.
 *
 * Visual: custom button that mirrors the native Apple Sign In button's
 * geometry (height, radius, width) and follows Google's brand guidelines
 * (white fill, #DADCE0 border, 4-color G logo, near-black label).
 */
function GoogleSignIn({onPress = () => {}}: GoogleSignInProps) {
  const {auth, db} = useFirebase();
  const {translate} = useLocalize();

  const handleSignIn = async () => {
    try {
      const idToken = await googleSignInRequest();
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
    <PressableWithFeedback
      style={styles.button}
      onPress={() => {
        handleSignIn();
      }}
      accessibilityRole="button"
      accessibilityLabel={translate('common.signInWithGoogle')}>
      <View style={styles.content}>
        <Icon src={KirokuIcons.GoogleG} width={16} height={16} />
        <Text style={styles.label}>{translate('common.signInWithGoogle')}</Text>
      </View>
    </PressableWithFeedback>
  );
}

export default GoogleSignIn;
export type {GoogleSignInProps};
