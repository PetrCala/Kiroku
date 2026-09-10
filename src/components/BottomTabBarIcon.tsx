import CONST from '@src/CONST';
import useThemeStyles from '@hooks/useThemeStyles';
import useTheme from '@hooks/useTheme';
import type IconAsset from '@src/types/utils/IconAsset';
import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import variables from '@src/styles/variables';
import CountBadge from './CountBadge';
import Icon from './Icon';
import Text from './Text';
import {PressableWithFeedback} from './Pressable';
import Tooltip from './Tooltip';

type BottomTabBarIconProps = {
  /** The icon source */
  src: IconAsset;

  /** The icon label * */
  label: string;

  /** Whether the icon is selected */
  isSelected: boolean;

  /** Accessibility label */
  accessibilityLabel: string;

  /** A callback to call on press of the button */
  onPress: () => void;

  /** The width of the icon. */
  width?: number;

  /** The height of the icon. */
  height?: number;

  /** Additional styles to add to the Icon */
  additionalStyles?: StyleProp<ViewStyle>;

  /** Count shown as a badge over the icon (e.g. pending friend requests); hidden when 0 or absent */
  badgeCount?: number;
};

function BottomTabBarIcon({
  src,
  label,
  isSelected,
  accessibilityLabel,
  onPress,
  width,
  height,
  additionalStyles,
  badgeCount = 0,
}: BottomTabBarIconProps) {
  const styles = useThemeStyles();
  const theme = useTheme();

  return (
    <Tooltip text={label}>
      <PressableWithFeedback
        onPress={onPress}
        role={CONST.ROLE.BUTTON}
        accessibilityLabel={
          badgeCount > 0
            ? `${accessibilityLabel} (${badgeCount})`
            : accessibilityLabel
        }
        wrapperStyle={styles.flex1}
        style={[styles.bottomTabBarItem, styles.flexColumn, additionalStyles]}>
        <View>
          <Icon
            src={src}
            fill={isSelected ? theme.appColor : theme.icon}
            width={width ?? variables.iconBottomBar}
            height={height ?? variables.iconBottomBar}
          />
          {badgeCount > 0 && (
            <CountBadge count={badgeCount} style={styles.bottomTabBarBadge} />
          )}
        </View>
        <Text style={[styles.bottomTabBarLabel(isSelected)]}>{label}</Text>
      </PressableWithFeedback>
    </Tooltip>
  );
}

BottomTabBarIcon.displayName = 'bottomTabBarIcon';
export default BottomTabBarIcon;
