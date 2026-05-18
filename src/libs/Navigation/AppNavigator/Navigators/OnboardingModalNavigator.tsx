import {createStackNavigator} from '@react-navigation/stack';
import React, {useCallback} from 'react';
import {View} from 'react-native';
import FocusTrapForScreens from '@components/FocusTrap/FocusTrapForScreen';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import useKeyboardShortcut from '@hooks/useKeyboardShortcut';
import useOnboardingLayout from '@hooks/useOnboardingLayout';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import getOnboardingModalScreenOptions from '@libs/Navigation/getTzFixModalScreenOptions';
import type {OnboardingModalNavigatorParamList} from '@libs/Navigation/types';
import {
  hasCompletedOnboarding,
  isLegacyGrandfatheredUser,
} from '@libs/OnboardingSelectors';
import OnboardingRefManager from '@libs/OnboardingRefManager';
import DisplayNameScreen from '@screens/Onboarding/DisplayNameScreen';
import TermsScreen from '@screens/Onboarding/TermsScreen';
import CONST from '@src/CONST';
import SCREENS from '@src/SCREENS';
import Overlay from './Overlay';

const Stack = createStackNavigator<OnboardingModalNavigatorParamList>();

function OnboardingModalNavigator() {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {isMediumOrLargerScreenWidth} = useOnboardingLayout();
  const {userData} = useDatabaseData();
  const isOnboardingCompleted =
    hasCompletedOnboarding(userData) || isLegacyGrandfatheredUser(userData);
  const {shouldUseNarrowLayout} = useResponsiveLayout();

  const outerViewRef = React.useRef<View>(null);

  const handleOuterClick = useCallback(() => {
    OnboardingRefManager.handleOuterClick();
  }, []);

  useKeyboardShortcut(CONST.KEYBOARD_SHORTCUTS.ESCAPE, handleOuterClick, {
    shouldBubble: true,
  });

  if (isOnboardingCompleted) {
    return null;
  }
  return (
    <>
      <Overlay />
      <View
        ref={outerViewRef}
        onClick={handleOuterClick}
        style={styles.onboardingNavigatorOuterView}>
        <FocusTrapForScreens>
          <View
            onClick={e => e.stopPropagation()}
            style={styles.OnboardingNavigatorInnerView(
              isMediumOrLargerScreenWidth,
            )}>
            <Stack.Navigator
              screenOptions={getOnboardingModalScreenOptions(
                shouldUseNarrowLayout,
                styles,
                StyleUtils,
              )}>
              <Stack.Screen
                name={SCREENS.ONBOARDING.TERMS}
                component={TermsScreen}
              />
              <Stack.Screen
                name={SCREENS.ONBOARDING.DISPLAY_NAME}
                component={DisplayNameScreen}
              />
            </Stack.Navigator>
          </View>
        </FocusTrapForScreens>
      </View>
    </>
  );
}

OnboardingModalNavigator.displayName = 'OnboardingModalNavigator';

export default OnboardingModalNavigator;
