import {createStackNavigator} from '@react-navigation/stack';
import React, {useCallback} from 'react';
import {View} from 'react-native';
import FocusTrapForScreens from '@components/FocusTrap/FocusTrapForScreen';
import useKeyboardShortcut from '@hooks/useKeyboardShortcut';
import useOnboardingLayout from '@hooks/useOnboardingLayout';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import getOnboardingModalScreenOptions from '@libs/Navigation/getOnboardingModalScreenOptions';
import type {OnboardingModalNavigatorParamList} from '@libs/Navigation/types';
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
  const {shouldUseNarrowLayout} = useResponsiveLayout();

  const outerViewRef = React.useRef<View>(null);

  const handleOuterClick = useCallback(() => {
    OnboardingRefManager.handleOuterClick();
  }, []);

  useKeyboardShortcut(CONST.KEYBOARD_SHORTCUTS.ESCAPE, handleOuterClick, {
    shouldBubble: true,
  });

  // Visibility is owned by React Navigation focus state, not Onyx. Do NOT add
  // an `isOnboardingCompleted ? null` short-circuit here — it races the
  // dismissal transition and produces a Home-flash on completion. Entry is
  // gated by `OnboardingGuard`; exit by `navigateAfterOnboarding()`.
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
                isMediumOrLargerScreenWidth,
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
