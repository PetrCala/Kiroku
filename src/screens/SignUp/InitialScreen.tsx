import React, {useRef} from 'react';
import {StyleSheet, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useFocusEffect} from '@react-navigation/native';
import {useFirebase} from '@context/global/FirebaseContext';
import Navigation from '@navigation/Navigation';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import CONST from '@src/CONST';
import * as CloseAccount from '@userActions/CloseAccount';
import * as Session from '@userActions/Session';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import ScreenWrapper from '@components/ScreenWrapper';
import useStyleUtils from '@hooks/useStyleUtils';
import useStyledSafeAreaInsets from '@hooks/useStyledSafeAreaInsets';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useLocalize from '@hooks/useLocalize';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import Button from '@components/Button';
import Text from '@components/Text';
import {PressableWithFeedback} from '@components/Pressable';
import DotIndicatorMessage from '@components/DotIndicatorMessage';
import SignUpScreenLayout from './SignUpScreenLayout';

type InitialScreenLayoutRef = {
  scrollPageToTop: (animated?: boolean) => void;
};

function InitialScreen() {
  const {auth} = useFirebase();
  const {translate} = useLocalize();
  const theme = useTheme();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const [closeAccount] = useOnyx(ONYXKEYS.FORMS.CLOSE_ACCOUNT_FORM);
  const [hasCheckedAutoLogin] = useOnyx(ONYXKEYS.HAS_CHECKED_AUTO_LOGIN);
  const {isInNarrowPaneModal} = useResponsiveLayout();
  const safeAreaInsets = useStyledSafeAreaInsets();
  const currentScreenLayoutRef = useRef<InitialScreenLayoutRef>(null);

  const welcomeHeader = translate('login.hero.header');
  const logInActionText = translate('common.logInHere');

  const navigateToAuth = (mode: 'signUp' | 'logIn') => {
    if (closeAccount?.success) {
      CloseAccount.setDefaultData();
    }
    Navigation.navigate(`${ROUTES.AUTH}?mode=${mode}` as Route);
  };

  const onGetStarted = () => navigateToAuth('signUp');
  const onLogIn = () => navigateToAuth('logIn');

  useFocusEffect(
    React.useCallback(() => {
      Session.clearSignInData();
      // Reset on each focus so the spinner reflects the current auth check, not a stale value from a previous mount.
      Session.setHasCheckedAutoLogin(false);
      const stopListening = auth.onAuthStateChanged(user => {
        if (!user) {
          Session.setHasCheckedAutoLogin(true);
          return;
        }
        Navigation.navigate(ROUTES.HOME);
      });

      return () => {
        stopListening();
      };
    }, [auth]),
  );

  const navigateFocus = () => {
    currentScreenLayoutRef.current?.scrollPageToTop();
  };

  return (
    <ScreenWrapper
      shouldShowOfflineIndicator={false}
      shouldEnableMaxHeight
      shouldUseCachedViewportHeight
      style={[
        styles.signUpScreen,
        StyleUtils.getSignUpSafeAreaPadding(
          safeAreaInsets,
          isInNarrowPaneModal,
        ),
      ]}
      testID={InitialScreen.displayName}>
      <SignUpScreenLayout
        welcomeHeader={welcomeHeader}
        welcomeText=""
        ref={currentScreenLayoutRef}
        navigateFocus={navigateFocus}>
        {!!closeAccount?.success && (
          <DotIndicatorMessage
            style={[styles.mv2]}
            type="success"
            messages={{
              // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/prefer-nullish-coalescing
              0: closeAccount?.success || '',
            }}
          />
        )}
        <Button
          large
          success
          text={translate('common.createAccount')}
          onPress={onGetStarted}
          isLoading={!hasCheckedAutoLogin}
          shouldEnableHapticFeedback
          style={[styles.mt5]}
        />
        {!!hasCheckedAutoLogin && (
          <View style={[styles.changeSignUpScreenLinkContainer, styles.mt4]}>
            <Text style={styles.mr1}>{translate('login.existingAccount')}</Text>
            <PressableWithFeedback
              style={[styles.link]}
              onPress={onLogIn}
              role={CONST.ROLE.LINK}
              accessibilityLabel={logInActionText}>
              <Text style={[styles.link]}>{logInActionText}</Text>
            </PressableWithFeedback>
          </View>
        )}
      </SignUpScreenLayout>
      {/* Overlays SignUpScreenLayout's iOS narrow-layout background; alpha kept very low to avoid tinting text. */}
      <LinearGradient
        colors={[`${theme.success}00`, `${theme.success}0A`]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
    </ScreenWrapper>
  );
}

InitialScreen.displayName = 'Initial Screen';
export default InitialScreen;
