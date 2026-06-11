import {appleAuthAndroid} from '@invertase/react-native-apple-authentication';
import {OAuthProvider} from 'firebase/auth';
import React from 'react';
import {StyleSheet, View} from 'react-native';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import ERRORS from '@src/ERRORS';
import * as ErrorUtils from '@libs/ErrorUtils';
import Log from '@libs/Log';
import * as App from '@userActions/App';
import * as User from '@userActions/User';
import CONFIG from '@src/CONFIG';

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

type AppleSignInProps = {
  onPress?: () => void;
  onError?: (message: string) => void;
};

type AppleAndroidSignInResult = {
  idToken: string | undefined;
  rawNonce: string | undefined;
  displayName: string | null;
};

/**
 * Performs the web-based Apple Sign In request on Android via appleAuthAndroid.
 * Returns the identity token and a best-effort display name (Apple only sends
 * the user's name on the very first sign-in).
 */
async function appleSignInRequestAndroid(): Promise<AppleAndroidSignInResult | null> {
  appleAuthAndroid.configure({
    clientId: CONFIG.APPLE_SIGN_IN.SERVICE_ID,
    redirectUri: CONFIG.APPLE_SIGN_IN.REDIRECT_URI,
    responseType: appleAuthAndroid.ResponseType.ALL,
    scope: appleAuthAndroid.Scope.ALL,
  });

  const response = await appleAuthAndroid.signIn();

  if (!response.id_token) {
    Log.alert(
      '[Apple Sign In] Android response missing id_token. Original response: ',
      {response},
    );
    return null;
  }

  const name = response.user?.name;
  const displayName =
    [name?.firstName, name?.lastName].filter(Boolean).join(' ') || null;

  return {
    idToken: response.id_token,
    rawNonce: response.nonce ?? undefined,
    displayName,
  };
}

/**
 * Apple Sign In button for Android.
 * Drives Apple's web-based OAuth flow via appleAuthAndroid, then passes the
 * resulting identity token to Firebase the same way the iOS variant does.
 *
 * Visual: custom button matching the native iOS AppleButton geometry and the
 * GoogleSignIn button (the library's JS AppleButton on Android renders no
 * logo and a smaller label, so we draw our own per Apple's brand guidelines:
 * black fill, white logo and label).
 */
function AppleSignIn({
  onPress = () => {},
  onError = () => {},
}: AppleSignInProps) {
  const {auth} = useFirebase();
  const {translate} = useLocalize();

  const handleSignIn = async () => {
    let loadingShown = false;
    try {
      const result = await appleSignInRequestAndroid();
      if (!result) {
        return;
      }

      const {idToken, rawNonce, displayName} = result;

      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: idToken ?? '',
        rawNonce,
      });

      onPress();
      // Shown at the Kiroku-level overlay so it stays visible across the
      // post-auth screen swap (AuthScreen → OnboardingGuard → next stack).
      await App.setLoadingText(translate('signUpScreen.signingYouIn'));
      loadingShown = true;
      try {
        await User.signInWithOAuth(auth, credential, displayName);
      } catch (firebaseError: unknown) {
        const fe = firebaseError as {code?: string};
        if (
          fe.code === ERRORS.AUTH.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL &&
          User.stashPendingOAuthCredential(firebaseError, {
            providerId: 'apple.com',
            idToken: idToken ?? '',
            rawNonce,
            displayName,
          })
        ) {
          // Collision modal will take over from here.
          return;
        }
        Log.alert('[Apple Sign In] Firebase signInWithCredential failed', {
          code: fe.code ?? 'unknown',
        });
        throw firebaseError;
      }
    } catch (error: unknown) {
      const e = error as {message?: string};
      // Android cancellation surfaces as a string message, not a code.
      if (e.message === appleAuthAndroid.Error.SIGNIN_CANCELLED) {
        return;
      }
      Log.alert(
        '[Apple Sign In] Apple authentication failed',
        error as Record<string, unknown>,
      );
      onError(ErrorUtils.getAppError(undefined, error).message);
    } finally {
      if (loadingShown) {
        await App.setLoadingText(null);
      }
    }
  };

  return (
    <PressableWithFeedback
      style={styles.button}
      onPress={() => {
        handleSignIn();
      }}
      accessibilityRole="button"
      accessibilityLabel={translate('common.signInWithApple')}>
      <View style={styles.content}>
        <Icon
          src={KirokuIcons.AppleLogo}
          width={18}
          height={18}
          fill="#FFFFFF"
        />
        <Text style={styles.label}>{translate('common.signInWithApple')}</Text>
      </View>
    </PressableWithFeedback>
  );
}

export default AppleSignIn;
export type {AppleSignInProps};
