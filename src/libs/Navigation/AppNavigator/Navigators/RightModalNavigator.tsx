import type {StackScreenProps} from '@react-navigation/stack';
import {createStackNavigator} from '@react-navigation/stack';
import React, {useMemo, useRef} from 'react';
// import NoDropZone from '@components/DragAndDrop/NoDropZone';
import useThemeStyles from '@hooks/useThemeStyles';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import ModalNavigatorScreenOptions from '@navigation/AppNavigator/ModalNavigatorScreenOptions';
import * as ModalStackNavigators from '@libs/Navigation/AppNavigator/ModalStackNavigators';
import sessionsCalendarCardStyleInterpolator from '@libs/Navigation/AppNavigator/ModalStackNavigators/sessionsCalendarTransition';
import type {
  AuthScreensParamList,
  RightModalNavigatorParamList,
} from '@navigation/types';
import type NAVIGATORS from '@src/NAVIGATORS';
import SCREENS from '@src/SCREENS';
import Overlay from './Overlay';

// Modal-style presentation for the fullscreen sessions calendar: the home
// screen stays mounted underneath while the calendar fades and grows into
// view, and a vertical pull-down dismisses it on iOS.
const SESSIONS_CALENDAR_SCREEN_OPTIONS = {
  presentation: 'transparentModal' as const,
  cardStyleInterpolator: sessionsCalendarCardStyleInterpolator,
  cardOverlayEnabled: false,
  gestureEnabled: true,
  gestureDirection: 'vertical' as const,
  cardStyle: {backgroundColor: 'transparent'},
};

type RightModalNavigatorProps = StackScreenProps<
  AuthScreensParamList,
  typeof NAVIGATORS.RIGHT_MODAL_NAVIGATOR
>;

const Stack = createStackNavigator<RightModalNavigatorParamList>();

function RightModalNavigator({navigation}: RightModalNavigatorProps) {
  const styles = useThemeStyles();
  const {shouldUseNarrowLayout} = useResponsiveLayout();
  const isExecutingRef = useRef<boolean>(false);
  const screenOptions = useMemo(
    () => ModalNavigatorScreenOptions(styles),
    [styles],
  );
  // const screenOptions = useMemo(() => {
  //     const options = ModalNavigatorScreenOptions(styles);
  //     // The .forHorizontalIOS interpolator from `@react-navigation` is misbehaving on Safari, so we override it with Kiroku custom interpolator
  //     if (isSafari()) {
  //         const customInterpolator = createModalCardStyleInterpolator(styleUtils);
  //         options.cardStyleInterpolator = (props: StackCardInterpolationProps) => customInterpolator(isSmallScreenWidth, false, false, props);
  //     }

  //     return options;
  // }, [isSmallScreenWidth, styleUtils, styles]);

  return (
    // <NoDropZone>
    // <View style={styles.RHPNavigatorContainer(isSmallScreenWidth)}>
    <>
      {!shouldUseNarrowLayout && (
        <Overlay
          onPress={() => {
            if (isExecutingRef.current) {
              return;
            }
            isExecutingRef.current = true;
            navigation.goBack();
          }}
        />
      )}
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen
          name={SCREENS.RIGHT_MODAL.ACHIEVEMENTS}
          component={ModalStackNavigators.AchievementsModalStackNavigator}
        />
        <Stack.Screen
          name={SCREENS.RIGHT_MODAL.DAY_OVERVIEW}
          component={ModalStackNavigators.DayOverviewModalStackNavigator}
        />
        <Stack.Screen
          name={SCREENS.RIGHT_MODAL.DRINKING_SESSION}
          component={ModalStackNavigators.DrinkingSessionModalStackNavigator}
        />
        <Stack.Screen
          name={SCREENS.RIGHT_MODAL.PROFILE}
          component={ModalStackNavigators.ProfileModalStackNavigator}
        />
        <Stack.Screen
          name={SCREENS.RIGHT_MODAL.SESSIONS_CALENDAR}
          component={ModalStackNavigators.SessionsCalendarModalStackNavigator}
          options={SESSIONS_CALENDAR_SCREEN_OPTIONS}
        />
        <Stack.Screen
          name={SCREENS.RIGHT_MODAL.SETTINGS}
          component={ModalStackNavigators.SettingsModalStackNavigator}
        />
        <Stack.Screen
          name={SCREENS.RIGHT_MODAL.SOCIAL}
          component={ModalStackNavigators.SocialModalStackNavigator}
        />
        <Stack.Screen
          name={SCREENS.RIGHT_MODAL.STATISTICS}
          component={ModalStackNavigators.StatisticsModalStackNavigator}
        />
      </Stack.Navigator>
    </>
  );
}

RightModalNavigator.displayName = 'RightModalNavigator';

export default RightModalNavigator;
