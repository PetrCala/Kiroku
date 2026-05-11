import type {
  DefaultNavigatorOptions,
  ParamListBase,
  StackNavigationState,
  StackRouterOptions,
} from '@react-navigation/native';
import type {
  StackNavigationEventMap,
  StackNavigationOptions,
} from '@react-navigation/stack';

type ResponsiveStackNavigatorConfig = {
  isSmallScreenWidth: boolean;
};

type ResponsiveStackNavigatorRouterOptions = StackRouterOptions;

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type ResponsiveStackNavigatorProps = DefaultNavigatorOptions<
  ParamListBase,
  StackNavigationState<ParamListBase>,
  StackNavigationOptions,
  StackNavigationEventMap
> &
  ResponsiveStackNavigatorConfig;

export type {
  ResponsiveStackNavigatorRouterOptions,
  ResponsiveStackNavigatorProps,
  ResponsiveStackNavigatorConfig,
};
