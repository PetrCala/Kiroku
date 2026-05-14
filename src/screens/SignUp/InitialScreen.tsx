import React, {useRef} from 'react';
import {View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useFirebase} from '@context/global/FirebaseContext';
import Navigation from '@navigation/Navigation';
import ROUTES from '@src/ROUTES';
import * as CloseAccount from '@userActions/CloseAccount';
import * as Session from '@userActions/Session';
import useThemeStyles from '@hooks/useThemeStyles';
import ScreenWrapper from '@components/ScreenWrapper';
import useStyleUtils from '@hooks/useStyleUtils';
import useStyledSafeAreaInsets from '@hooks/useStyledSafeAreaInsets';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useLocalize from '@hooks/useLocalize';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import Button from '@components/Button';
import DotIndicatorMessage from '@components/DotIndicatorMessage';
import SignUpScreenLayout from './SignUpScreenLayout';

type InitialScreenLayoutRef = {
  scrollPageToTop: (animated?: boolean) => void;
};

function InitialScreen() {
  const {auth} = useFirebase();
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const [closeAccount] = useOnyx(ONYXKEYS.FORMS.CLOSE_ACCOUNT_FORM);
  const {isInNarrowPaneModal} = useResponsiveLayout();
  const safeAreaInsets = useStyledSafeAreaInsets();
  const currentScreenLayoutRef = useRef<InitialScreenLayoutRef>(null);

  const welcomeHeader = translate('login.hero.header');

  const onGetStarted = () => {
    if (closeAccount?.success) {
      CloseAccount.setDefaultData();
    }
    Navigation.navigate(ROUTES.AUTH);
  };

  useFocusEffect(
    React.useCallback(() => {
      Session.clearSignInData();
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
        <View style={[styles.mt5, styles.mb5]}>
          <Button
            large
            success
            text={translate('common.getStarted')}
            onPress={onGetStarted}
          />
        </View>
      </SignUpScreenLayout>
    </ScreenWrapper>
  );
}

InitialScreen.displayName = 'Initial Screen';
export default InitialScreen;
