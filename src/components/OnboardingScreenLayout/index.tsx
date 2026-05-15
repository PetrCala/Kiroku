import React, {useCallback, useEffect, useState} from 'react';
import {BackHandler} from 'react-native';
import Button from '@components/Button';
import ConfirmModal from '@components/ConfirmModal';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as Session from '@userActions/Session';

type OnboardingScreenLayoutProps = {
  /** Title rendered in the header */
  title?: string;

  /** 1-based position of this screen in the flow */
  currentStep: number;

  /** Total number of screens currently known in the flow */
  totalSteps: number;

  /** Whether more screens may follow — renders the trailing "+" in "Step N of M+" */
  hasMore?: boolean;

  /** First screen blocks the back arrow and the hardware back press */
  isFirstScreen?: boolean;

  /** testID forwarded to the ScreenWrapper for test discovery */
  testID: string;

  /** Screen body */
  children: React.ReactNode;
};

function OnboardingScreenLayout({
  title,
  currentStep,
  totalSteps,
  hasMore = true,
  isFirstScreen = false,
  testID,
  children,
}: OnboardingScreenLayoutProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {auth} = useFirebase();
  const [isSignOutConfirmVisible, setIsSignOutConfirmVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const backAction = () => {
      if (isFirstScreen) {
        return true;
      }
      Navigation.goBack();
      return true;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => {
      subscription.remove();
    };
  }, [isFirstScreen]);

  const onSignOutConfirm = useCallback(() => {
    (async () => {
      setIsSignOutConfirmVisible(false);
      setIsSigningOut(true);
      await Session.signOut(auth);
      setIsSigningOut(false);
    })();
  }, [auth]);

  if (isSigningOut) {
    return (
      <FullScreenLoadingIndicator
        loadingText={translate('settingsScreen.signingOut')}
      />
    );
  }

  return (
    <ScreenWrapper testID={testID}>
      <HeaderWithBackButton
        title={title}
        subtitle={translate('onboarding.stepCounter', {
          currentStep,
          totalSteps,
          hasMore,
        })}
        shouldShowBackButton={!isFirstScreen}
        customRightButton={
          <Button
            small
            text={translate('settingsScreen.signOut')}
            onPress={() => setIsSignOutConfirmVisible(true)}
            style={styles.buttonSmall}
          />
        }
      />
      {children}
      <ConfirmModal
        danger
        title={translate('common.areYouSure')}
        prompt={translate('settingsScreen.signOutConfirmationText')}
        confirmText={translate('settingsScreen.signOut')}
        cancelText={translate('common.cancel')}
        isVisible={isSignOutConfirmVisible}
        onConfirm={onSignOutConfirm}
        onCancel={() => setIsSignOutConfirmVisible(false)}
      />
    </ScreenWrapper>
  );
}

OnboardingScreenLayout.displayName = 'OnboardingScreenLayout';

export default OnboardingScreenLayout;
