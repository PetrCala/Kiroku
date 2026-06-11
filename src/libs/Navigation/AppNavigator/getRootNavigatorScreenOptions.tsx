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
import SCREENS from '@src/SCREENS';
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
  dayOverviewNavigator: StackNavigationOptions;
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

/**
 * Name of the right-modal screen currently shown (e.g. `Profile`, `Settings`).
 * Used to opt a screen out of the root-level swipe-back so its content can own
 * a competing horizontal gesture — the Profile calendar's month-swipe, which a
 * native card pan would otherwise steal.
 */
function getActiveRightModalRouteName(state: NestedState): string | undefined {
  if (!state?.routes) {
    return undefined;
  }
  const activeIndex = state.index ?? 0;
  return state.routes[activeIndex]?.name;
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

  // Shared "lift in from the center" transparent modal: the card fades and
  // scales in (see sessionsCalendarCardStyleInterpolator) over the screen
  // beneath it. Both calendar drill-downs — the fullscreen calendar and the
  // day-overview scroll — use it so they look and behave identically.
  // `gestureResponseDistance` stays at the platform default so the edge
  // swipe-back doesn't fight the content's vertical scroll; each screen adds a
  // content-level SwipeBackGestureDetector for full-width swipe-to-dismiss.
  const centerModalScreenOptions: StackNavigationOptions = {
    ...commonScreenOptions,
    cardStyleInterpolator: sessionsCalendarCardStyleInterpolator,
    presentation: 'transparentModal',
    cardOverlayEnabled: false,
    cardStyle: {backgroundColor: 'transparent'},
    gestureEnabled: true,
    gestureDirection: 'horizontal',
  };

  return {
    // Function form so React Navigation re-evaluates gestureEnabled when the
    // nested stack state changes. Root-level swipe-back is enabled only when
    // no inner stack has cards left to pop, so the inner card pops one step
    // at a time and the outermost swipe dismisses the modal once the inner
    // stack bottoms out.
    rightModalNavigator: ({route}) => ({
      ...rightModalStaticOptions,
      // Profile is excluded so its content-level SwipeBackGestureDetector can
      // own dismissal and yield to the calendar's month-swipe — the full-width
      // card pan (gestureResponseDistance: 10000) would otherwise steal it.
      gestureEnabled:
        Platform.OS === 'ios' &&
        !hasPoppableInnerStack((route as {state?: NestedState}).state) &&
        getActiveRightModalRouteName((route as {state?: NestedState}).state) !==
          SCREENS.RIGHT_MODAL.PROFILE,
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
    // Fullscreen sessions calendar and day-overview scroll share the same
    // center-lift modal (see centerModalScreenOptions) so the two calendar
    // drill-downs feel identical.
    sessionsCalendarNavigator: centerModalScreenOptions,
    dayOverviewNavigator: centerModalScreenOptions,
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
