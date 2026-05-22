import type {
  StackCardInterpolationProps,
  StackNavigationOptions,
} from '@react-navigation/stack';
import type {
  NavigationState,
  PartialState,
  RouteProp,
} from '@react-navigation/native';
import {Platform} from 'react-native';
import type {ViewStyle} from 'react-native';
import type {ThemeStyles} from '@styles/index';
import type {StyleUtilsType} from '@styles/utils';
import variables from '@styles/variables';
import CONFIG from '@src/CONFIG';
import createModalCardStyleInterpolator from './createModalCardStyleInterpolator';
import getModalPresentationStyle from './getModalPresentationStyle';
import sessionsCalendarCardStyleInterpolator from './ModalStackNavigators/sessionsCalendarTransition';

type GetOnboardingModalNavigatorOptions = (
  shouldUseNarrowLayout: boolean,
) => StackNavigationOptions;

type DynamicScreenOptions = (props: {
  route: RouteProp<Record<string, Record<string, unknown> | undefined>, string>;
}) => StackNavigationOptions;

type ScreenOptions = {
  rightModalNavigator: DynamicScreenOptions;
  onboardingModalNavigator: GetOnboardingModalNavigatorOptions;
  sessionsCalendarNavigator: StackNavigationOptions;
  leftModalNavigator: StackNavigationOptions;
  homeScreen: StackNavigationOptions;
  fullScreen: StackNavigationOptions;
  centralPaneNavigator: StackNavigationOptions;
  bottomTab: StackNavigationOptions;
};

const commonScreenOptions: StackNavigationOptions = {
  headerShown: false,
  gestureDirection: 'horizontal',
  cardOverlayEnabled: true,
  animationTypeForReplace: 'push',
};

type NestedState = NavigationState | PartialState<NavigationState> | undefined;

/**
 * True if any nested stack inside this route has an active index > 0,
 * meaning an inner gesture has cards to pop. When false, the outer
 * (root-level) gesture is safe to handle the swipe as a modal dismiss.
 */
function hasPoppableInnerStack(state: NestedState): boolean {
  if (!state?.routes) {
    return false;
  }
  const activeIndex = state.index ?? 0;
  if (activeIndex > 0) {
    return true;
  }
  const activeRoute = state.routes[activeIndex];
  return hasPoppableInnerStack(activeRoute?.state);
}

type GetRootNavigatorScreenOptions = (
  isSmallScreenWidth: boolean,
  styles: ThemeStyles,
  StyleUtils: StyleUtilsType,
) => ScreenOptions;

const getRootNavigatorScreenOptions: GetRootNavigatorScreenOptions = (
  isSmallScreenWidth,
  themeStyles,
  StyleUtils,
) => {
  const modalCardStyleInterpolator =
    createModalCardStyleInterpolator(StyleUtils);

  const rightModalStaticOptions: StackNavigationOptions = {
    ...commonScreenOptions,
    cardStyleInterpolator: (props: StackCardInterpolationProps) =>
      modalCardStyleInterpolator(isSmallScreenWidth, false, false, props),
    presentation: getModalPresentationStyle(),

    // We want pop in RHP since there are some flows that would work weird otherwise
    animationTypeForReplace: 'pop',
    gestureResponseDistance: 10000,
    cardStyle: {
      ...StyleUtils.getNavigationModalCardStyle(),

      // This is necessary to cover translated sidebar with overlay.
      width: isSmallScreenWidth ? '100%' : '200%',
      // Excess space should be on the left so we need to position from right.
      right: 0,
    },
  };

  return {
    // Function form so React Navigation re-evaluates gestureEnabled when the
    // nested stack state changes. Root-level swipe-back is enabled only when
    // no inner stack has cards left to pop, so the inner card pops one step
    // at a time and the outermost swipe dismisses the modal once the inner
    // stack bottoms out.
    rightModalNavigator: ({route}) => ({
      ...rightModalStaticOptions,
      gestureEnabled:
        Platform.OS === 'ios' &&
        !hasPoppableInnerStack((route as {state?: NestedState}).state),
    }),
    onboardingModalNavigator: (shouldUseNarrowLayout: boolean) => ({
      cardStyleInterpolator: (props: StackCardInterpolationProps) =>
        modalCardStyleInterpolator(
          isSmallScreenWidth,
          false,
          shouldUseNarrowLayout,
          props,
        ),
      headerShown: false,
      cardOverlayEnabled: false,
      presentation: 'transparentModal',
      cardStyle: {
        ...StyleUtils.getNavigationModalCardStyle(),
        backgroundColor: 'transparent',
        width: '100%',
        top: 0,
        left: 0,
        // We need to guarantee that it covers BottomTabBar on web, but fixed position is not supported in react native.
        position: 'fixed' as ViewStyle['position'],
      },
    }),
    // Fullscreen sessions calendar — transparent modal so the prior screen
    // (Home or Profile) stays visible underneath while the calendar fades
    // and scales in. Standard left-edge swipe-right dismisses; we leave
    // `gestureResponseDistance` at the platform default to avoid
    // competing with the FlashList's vertical scroll handler.
    sessionsCalendarNavigator: {
      ...commonScreenOptions,
      cardStyleInterpolator: sessionsCalendarCardStyleInterpolator,
      presentation: 'transparentModal',
      cardOverlayEnabled: false,
      cardStyle: {backgroundColor: 'transparent'},
      gestureEnabled: true,
      gestureDirection: 'horizontal',
    },
    leftModalNavigator: {
      ...commonScreenOptions,
      cardStyleInterpolator: props =>
        modalCardStyleInterpolator(isSmallScreenWidth, false, false, props),
      presentation: getModalPresentationStyle(),
      gestureDirection: 'horizontal-inverted',

      // We want pop in LHP since there are some flows that would work weird otherwise
      animationTypeForReplace: 'pop',
      cardStyle: {
        ...StyleUtils.getNavigationModalCardStyle(),

        // This is necessary to cover translated sidebar with overlay.
        width: isSmallScreenWidth ? '100%' : '200%',

        // LHP should be displayed in place of the sidebar
        left: isSmallScreenWidth ? 0 : -variables.sideBarWidth,
      },
    },
    homeScreen: {
      title: CONFIG.SITE_TITLE,
      ...commonScreenOptions,
      cardStyleInterpolator: (props: StackCardInterpolationProps) =>
        modalCardStyleInterpolator(isSmallScreenWidth, false, false, props),

      cardStyle: {
        ...StyleUtils.getNavigationModalCardStyle(),
        width: isSmallScreenWidth ? '100%' : variables.sideBarWidth,

        // We need to shift the sidebar to not be covered by the StackNavigator so it can be clickable.
        marginLeft: isSmallScreenWidth ? 0 : -variables.sideBarWidth,
        ...(isSmallScreenWidth ? {} : themeStyles.borderRight),
      },
    },

    fullScreen: {
      ...commonScreenOptions,
      cardStyleInterpolator: (props: StackCardInterpolationProps) =>
        modalCardStyleInterpolator(isSmallScreenWidth, true, false, props),
      cardStyle: {
        ...StyleUtils.getNavigationModalCardStyle(),

        // This is necessary to cover whole screen. Including translated sidebar.
        marginLeft: isSmallScreenWidth ? 0 : -variables.sideBarWidth,
      },
    },

    centralPaneNavigator: {
      title: CONFIG.SITE_TITLE,
      ...commonScreenOptions,
      cardStyleInterpolator: (props: StackCardInterpolationProps) =>
        modalCardStyleInterpolator(isSmallScreenWidth, true, false, props),

      cardStyle: {
        ...StyleUtils.getNavigationModalCardStyle(),
        paddingRight: isSmallScreenWidth ? 0 : variables.sideBarWidth,
      },
    },

    bottomTab: {
      ...commonScreenOptions,
      cardStyleInterpolator: (props: StackCardInterpolationProps) =>
        modalCardStyleInterpolator(isSmallScreenWidth, false, false, props),

      cardStyle: {
        ...StyleUtils.getNavigationModalCardStyle(),
        width: isSmallScreenWidth ? '100%' : variables.sideBarWidth,

        // We need to shift the sidebar to not be covered by the StackNavigator so it can be clickable.
        marginLeft: isSmallScreenWidth ? 0 : -variables.sideBarWidth,
        ...(isSmallScreenWidth ? {} : themeStyles.borderRight),
      },
    },
  };
};

export default getRootNavigatorScreenOptions;
