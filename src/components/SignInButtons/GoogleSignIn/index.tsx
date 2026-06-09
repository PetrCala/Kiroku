import React, {useCallback, useEffect, useRef} from 'react';
import {View} from 'react-native';
import {GoogleAuthProvider} from 'firebase/auth';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import ERRORS from '@src/ERRORS';
import * as ErrorUtils from '@libs/ErrorUtils';
import Log from '@libs/Log';
import * as App from '@userActions/App';
import * as User from '@userActions/User';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';

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
 * Mirrors the native flow: obtain a Google ID token, wrap it in a Firebase
 * credential and run it through the shared `signInWithOAuth` path (including the
 * "account exists with a different credential" collision handling). The token is
 * sourced from Google Identity Services (the web equivalent of
 * `@react-native-google-signin`), which renders its own brand-compliant button.
 *
 * The structure follows the upstream Expensify web implementation (inject the
 * GIS client script, then `initialize` + `renderButton`); only the credential
 * handler is Kiroku-specific because we authenticate through Firebase.
 */
function GoogleSignIn({
  onPress = () => {},
  onError = () => {},
}: GoogleSignInProps) {
  const {auth} = useFirebase();
  const {translate} = useLocalize();
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

      const measuredWidth = Math.round(container.getBoundingClientRect().width);
      const width = Math.min(
        MAX_BUTTON_WIDTH,
        Math.max(MIN_BUTTON_WIDTH, measuredWidth || DEFAULT_BUTTON_WIDTH),
      );

      google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        shape: 'pill',
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
    <View style={{width: '100%', alignItems: 'center'}}>
      <div
        ref={containerRef}
        role={CONST.ROLE.BUTTON}
        aria-label={translate('common.signInWithGoogle')}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          minHeight: 44,
        }}
      />
    </View>
  );
}

export default GoogleSignIn;
export type {GoogleSignInProps};
