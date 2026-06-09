import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {View} from 'react-native';
import BottomTabBarIcon from '@components/BottomTabBarIcon';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import BOTTOM_TAB_CONFIG from '@navigation/AppNavigator/Navigators/bottomTabConfig';

/**
 * Custom JS tab bar for the web bottom tab navigator. The native
 * (`react-native-bottom-tabs`) bar is not available on web, so this renders the
 * four tabs from `bottomTabConfig` with a live selected state. Tab switching is
 * tap-only — matching the native bar — and is instant because all tab roots stay
 * mounted.
 */
function BottomTabBar({state, navigation}: BottomTabBarProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  return (
    <View style={[styles.bottomTabBarContainer, styles.ph1]}>
      {state.routes.map((route, index) => {
        const tab = BOTTOM_TAB_CONFIG.find(item => item.name === route.name);
        if (!tab) {
          return null;
        }
        const isSelected = state.index === index;
        const label = translate(tab.labelKey);
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isSelected && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };
        return (
          <BottomTabBarIcon
            key={route.key}
            src={tab.webIcon}
            label={label}
            isSelected={isSelected}
            onPress={onPress}
            accessibilityLabel={label}
          />
        );
      })}
    </View>
  );
}

export default BottomTabBar;
