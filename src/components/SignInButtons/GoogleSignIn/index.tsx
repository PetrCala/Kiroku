import React, {useCallback, useEffect, useRef} from 'react';
import {View} from 'react-native';
import {GoogleAuthProvider} from 'firebase/auth';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
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

type GoogleSignInProps = {
  onPress?: () => void;
  onError?: (message: string) => void;
};

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

// Google Identity Services clamps the rendered button width to [200, 400] px.
const MIN_BUTTON_WIDTH = 200;
const MAX_BUTTON_WIDTH = 400;
const DEFAULT_BUTTON_WIDTH = 320;

/**
 * Google Sign In button for web.
 *
 * Renders a custom button matching the iOS/Android variant's geometry (white
 * fill, #DADCE0 border, height 48, radius 8, 4-color G logo, our own localized
 * label) so it lines up with the Apple button instead of using GIS's pill-shaped,
 * Google-localized widget.
 *
 * Google Identity Services requires its OWN button element to issue the
 * credential, so we render the GIS button INVISIBLY (opacity 0) on top of ours
 * to capture the click while the styled button shows through beneath. This keeps
 * the exact idToken → `signInWithOAuth` flow (including the "account exists with
 * a different credential" collision handling) with no backend change.
 *
 * The credential handler mirrors the upstream Expensify web implementation; only
 * the button presentation is Kiroku-specific.
 */
function GoogleSignIn({
  onPress = () => {},
  onError = () => {},
}: GoogleSignInProps) {
  const {auth} = useFirebase();
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const signIn = useCallback(
    async (idToken: string) => {
      let loadingShown = false;
      try {
        const credential = GoogleAuthProvider.credential(idToken);
        onPress();
        // Shown at the Kiroku-level overlay so it stays visible across the
        // post-auth screen swap (AuthScreen → OnboardingGuard → next stack).
        await App.setLoadingText(translate('signUpScreen.signingYouIn'));
        loadingShown = true;
        try {
          await User.signInWithOAuth(auth, credential);
        } catch (firebaseError: unknown) {
          const fe = firebaseError as {code?: string};
          if (
            fe.code === ERRORS.AUTH.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL &&
            User.stashPendingOAuthCredential(firebaseError, {
              providerId: 'google.com',
              idToken,
            })
          ) {
            // Collision modal will take over from here.
            return;
          }
          Log.alert('[Google Sign In] Firebase signInWithCredential failed', {
            code: fe.code ?? 'unknown',
          });
          throw firebaseError;
        }
      } catch (error: unknown) {
        const e = error as {code?: string; message?: string};
        Log.alert(
          `[Google Sign In] Error code: ${e.code ?? 'unknown'}. ${e.message ?? ''}`,
          {},
          false,
        );
        onError(ErrorUtils.getAppError(undefined, error).message);
      } finally {
        if (loadingShown) {
          await App.setLoadingText(null);
        }
      }
    },
    [auth, translate, onPress, onError],
  );

  // Keep the latest handler in a ref so the GIS callback (registered once below)
  // always sees current props/auth without re-injecting Google's button.
  const signInRef = useRef(signIn);
  useEffect(() => {
    signInRef.current = signIn;
  }, [signIn]);

  useEffect(() => {
    const webClientId = CONFIG.GOOGLE_SIGN_IN.WEB_CLIENT_ID;
    if (!webClientId || typeof document === 'undefined') {
      if (!webClientId) {
        Log.warn(
          '[Google Sign In] No web client ID configured; the Google button is hidden on web',
        );
      }
      return undefined;
    }

    const renderGoogleButton = () => {
      const google = window.google;
      const container = containerRef.current;
      if (!google || !container) {
        return;
      }

      google.accounts.id.initialize({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        client_id: webClientId,
        callback: response => {
          if (response.credential) {
            signInRef.current(response.credential);
          }
        },
      });

      // The GIS button is invisible and only there to capture the click, so
      // render it as wide as our button to maximize the hit area.
      const measuredWidth = Math.round(container.getBoundingClientRect().width);
      const width = Math.min(
        MAX_BUTTON_WIDTH,
        Math.max(MIN_BUTTON_WIDTH, measuredWidth || DEFAULT_BUTTON_WIDTH),
      );

      // Clear any previous render (e.g. on remount) before re-rendering.
      container.replaceChildren();
      google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        shape: 'rectangular',
        width: `${width}px`,
      });
    };

    // The script may already be present (e.g. on remount); reuse it if so.
    if (window.google) {
      renderGoogleButton();
      return undefined;
    }

    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', renderGoogleButton);
    document.body.appendChild(script);

    return () => {
      script.removeEventListener('load', renderGoogleButton);
    };
  }, []);

  return (
    <View
      style={[
        styles.signInProviderButton,
        styles.googleSignInButton,
        // Anchor the invisible GIS overlay and clip it to the button's radius.
        {position: 'relative', overflow: 'hidden'},
      ]}>
      {/* Visual layer — clicks pass through to the GIS button beneath. */}
      <View style={styles.signInProviderButtonContent} pointerEvents="none">
        <Icon src={KirokuIcons.GoogleG} width={16} height={16} />
        <Text
          style={[
            styles.signInProviderButtonLabel,
            styles.googleSignInButtonLabel,
          ]}>
          {translate('common.signInWithGoogle')}
        </Text>
      </View>
      {/* Invisible GIS button that actually issues the credential on click. */}
      <div
        ref={containerRef}
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
        }}
      />
    </View>
  );
}

export default GoogleSignIn;
export type {GoogleSignInProps};
