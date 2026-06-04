import type {StackScreenProps} from '@react-navigation/stack';
import {createStackNavigator} from '@react-navigation/stack';
import React, {useMemo, useRef} from 'react';
// import NoDropZone from '@components/DragAndDrop/NoDropZone';
import useThemeStyles from '@hooks/useThemeStyles';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import ModalNavigatorScreenOptions from '@navigation/AppNavigator/ModalNavigatorScreenOptions';
import * as ModalStackNavigators from '@libs/Navigation/AppNavigator/ModalStackNavigators';
import type {
  AuthScreensParamList,
  RightModalNavigatorParamList,
} from '@navigation/types';
import type NAVIGATORS from '@src/NAVIGATORS';
import SCREENS from '@src/SCREENS';
import Overlay from './Overlay';

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
