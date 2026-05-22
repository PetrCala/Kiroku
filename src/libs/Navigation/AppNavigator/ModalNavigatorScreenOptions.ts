import type {StackNavigationOptions} from '@react-navigation/stack';
import {CardStyleInterpolators} from '@react-navigation/stack';
import {Platform} from 'react-native';
import type {ThemeStyles} from '@styles/index';

/**
 * Modal stack navigator screen options generator function
 * @param themeStyles - The styles object
 * @returns The screen options object
 */
const ModalNavigatorScreenOptions = (
  themeStyles: ThemeStyles,
): StackNavigationOptions => ({
  headerShown: false,
  gestureDirection: 'horizontal',
  gestureEnabled: Platform.OS !== 'web',
  gestureResponseDistance: 10000,
  cardStyle: themeStyles.navigationScreenCardStyle,
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
});

export default ModalNavigatorScreenOptions;
