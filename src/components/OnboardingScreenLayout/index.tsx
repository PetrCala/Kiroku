import React, {useCallback, useEffect, useState} from 'react';
import {BackHandler, View} from 'react-native';
import Button from '@components/Button';
import ConfirmModal from '@components/ConfirmModal';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import PressableWithoutFeedback from '@components/Pressable/PressableWithoutFeedback';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as Session from '@userActions/Session';

type OnboardingScreenLayoutProps = {
  /** 1-based position of this screen in the flow */
  currentStep: number;

  /** Total number of screens currently known in the flow */
  totalSteps: number;

  /** First screen blocks the back arrow and the hardware back press */
  isFirstScreen?: boolean;

  /** testID forwarded to the ScreenWrapper for test discovery */
  testID: string;

  /** Screen body */
  children: React.ReactNode;
};

function OnboardingScreenLayout({
  currentStep,
  totalSteps,
  isFirstScreen = false,
  testID,
  children,
}: OnboardingScreenLayoutProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
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
      <View
        style={[
          styles.flexRow,
          styles.justifyContentBetween,
          styles.alignItemsCenter,
          styles.ph5,
          styles.pv3,
        ]}>
        <View style={[styles.flexRow, styles.alignItemsCenter, styles.flex1]}>
          {!isFirstScreen && (
            <PressableWithoutFeedback
              onPress={() => Navigation.goBack()}
              accessibilityLabel={translate('common.back')}
              role="button"
              style={[styles.mr2]}>
              <Icon src={KirokuIcons.BackArrow} fill={theme.icon} />
            </PressableWithoutFeedback>
          )}
          <View style={[styles.flex1]}>
            <Text style={[styles.textHeadlineH1]}>
              {translate('onboarding.title')}
            </Text>
            <Text style={[styles.textLabelSupporting]}>
              {translate('onboarding.stepCounter', {
                currentStep,
                totalSteps,
              })}
            </Text>
          </View>
        </View>
        <Button
          small
          text={translate('settingsScreen.signOut')}
          onPress={() => setIsSignOutConfirmVisible(true)}
          style={styles.buttonSmall}
        />
      </View>
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
