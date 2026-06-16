import {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
  getRandomBytes,
} from 'expo-crypto';
import type {Auth} from 'firebase/auth';
import {OAuthProvider} from 'firebase/auth';
import React, {useEffect} from 'react';
import {View} from 'react-native';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import ERRORS from '@src/ERRORS';
import * as ErrorUtils from '@libs/ErrorUtils';
import Log from '@libs/Log';
import * as App from '@userActions/App';
import * as User from '@userActions/User';
import CONFIG from '@src/CONFIG';

type AppleSignInProps = {
  onPress?: () => void;
  onError?: (message: string) => void;
};

// Sign in with Apple JS SDK. Exposes window.AppleID once loaded.
const APPLE_SDK_SRC =
  'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

// Apple surfaces a user-dismissed popup as this error string (there is no code).
const APPLE_POPUP_CLOSED = 'popup_closed_by_user';

// Matches the iOS variant's nonce: 32 random bytes as a lowercase hex string.
function generateRawNonce(): string {
  const bytes = getRandomBytes(32);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

type RunSignInParams = {
  auth: Auth;
  loadingText: string;
  onPress: () => void;
  onError: (message: string) => void;
};

/**
 * Drives Apple's popup-based "Sign in with Apple JS" OAuth flow, then passes the
 * resulting identity token to Firebase the same way the iOS/Android variants do
 * (OAuthProvider credential → shared `signInWithOAuth`, including the "account
 * exists with a different credential" collision handling).
 *
 * Nonce handling differs from the native SDKs: the JS SDK embeds the `nonce` we
 * give it into the identity token *verbatim*, whereas the native SDKs SHA-256
 * hash it first. Firebase validates the token's nonce against `SHA-256(rawNonce)`,
 * so on web we hash it ourselves — sending the hash to Apple and keeping the raw
 * value for the Firebase credential.
 *
 * Lives at module scope (not inside the component) so React Compiler does not
 * attempt to lower its try/catch/finally + rethrow, which it cannot compile.
 */
async function runAppleWebSignIn({
  auth,
  loadingText,
  onPress,
  onError,
}: RunSignInParams): Promise<void> {
  const appleID = window.AppleID;
  if (!appleID) {
    Log.alert('[Apple Sign In] JS SDK not loaded');
    onError(ErrorUtils.getAppError().message);
    return;
  }

  let loadingShown = false;
  try {
    const rawNonce = generateRawNonce();
    const hashedNonce = await digestStringAsync(
      CryptoDigestAlgorithm.SHA256,
      rawNonce,
      {encoding: CryptoEncoding.HEX},
    );

    appleID.auth.init({
      clientId: CONFIG.APPLE_SIGN_IN.SERVICE_ID,
      redirectURI: CONFIG.APPLE_SIGN_IN.REDIRECT_URI,
      scope: 'name email',
      usePopup: true,
      // Apple echoes this into the token verbatim; Firebase expects SHA-256(rawNonce).
      nonce: hashedNonce,
    });

    const data = await appleID.auth.signIn();
    const idToken = data.authorization?.id_token;
    if (!idToken) {
      Log.alert('[Apple Sign In] Web response missing id_token', {data});
      return;
    }

    // Apple only provides the name on the very first sign-in.
    const name = data.user?.name;
    const displayName =
      [name?.firstName, name?.lastName].filter(Boolean).join(' ') || null;

    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({idToken, rawNonce});

    onPress();
    // Shown at the Kiroku-level overlay so it stays visible across the
    // post-auth screen swap (AuthScreen → OnboardingGuard → next stack).
    await App.setLoadingText(loadingText);
    loadingShown = true;
    try {
      await User.signInWithOAuth(auth, credential, displayName);
    } catch (firebaseError: unknown) {
      const fe = firebaseError as {code?: string};
      if (
        fe.code === ERRORS.AUTH.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL &&
        User.stashPendingOAuthCredential(firebaseError, {
          providerId: 'apple.com',
          idToken,
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
    const e = error as {error?: string; message?: string};
    // The user closing the Apple popup is a cancellation, not an error.
    if (e.error === APPLE_POPUP_CLOSED) {
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
}

/**
 * Apple Sign In button for web.
 *
 * Visual: a custom black button matching the iOS AppleButton geometry and the
 * Android variant (Apple's JS SDK button does not fit the layout).
 */
function AppleSignIn({
  onPress = () => {},
  onError = () => {},
}: AppleSignInProps) {
  const {auth} = useFirebase();
  const {translate} = useLocalize();
  const styles = useThemeStyles();

  const isConfigured = Boolean(
    CONFIG.APPLE_SIGN_IN.SERVICE_ID && CONFIG.APPLE_SIGN_IN.REDIRECT_URI,
  );

  // Inject Apple's JS SDK once so window.AppleID is available on press.
  useEffect(() => {
    if (!isConfigured) {
      Log.warn(
        '[Apple Sign In] Service ID or redirect URI not configured; the Apple button is hidden on web',
      );
      return;
    }
    // The script may already be present (e.g. on remount); reuse it if so.
    if (typeof document === 'undefined' || window.AppleID) {
      return;
    }

    const script = document.createElement('script');
    script.src = APPLE_SDK_SRC;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [isConfigured]);

  if (!isConfigured) {
    return null;
  }

  return (
    <PressableWithFeedback
      style={[styles.signInProviderButton, styles.appleSignInButton]}
      onPress={() => {
        runAppleWebSignIn({
          auth,
          loadingText: translate('signUpScreen.signingYouIn'),
          onPress,
          onError,
        });
      }}
      accessibilityRole="button"
      accessibilityLabel={translate('common.signInWithApple')}>
      <View style={styles.signInProviderButtonContent}>
        <Icon
          src={KirokuIcons.AppleLogo}
          width={18}
          height={18}
          fill={styles.appleSignInButtonLabel.color}
        />
        <Text
          style={[
            styles.signInProviderButtonLabel,
            styles.appleSignInButtonLabel,
          ]}>
          {translate('common.signInWithApple')}
        </Text>
      </View>
    </PressableWithFeedback>
  );
}

export default AppleSignIn;
export type {AppleSignInProps};
