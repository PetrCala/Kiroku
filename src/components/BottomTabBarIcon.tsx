import CONST from '@src/CONST';
import useThemeStyles from '@hooks/useThemeStyles';
import useTheme from '@hooks/useTheme';
import type IconAsset from '@src/types/utils/IconAsset';
import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import variables from '@src/styles/variables';
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
}: BottomTabBarIconProps) {
  const styles = useThemeStyles();
  const theme = useTheme();

  return (
    <Tooltip text={label}>
      <PressableWithFeedback
        onPress={onPress}
        role={CONST.ROLE.BUTTON}
        accessibilityLabel={accessibilityLabel}
        wrapperStyle={styles.flex1}
        style={[styles.bottomTabBarItem, styles.flexColumn, additionalStyles]}>
        <View>
          <Icon
            src={src}
            fill={isSelected ? theme.appColor : theme.icon}
            width={width ?? variables.iconBottomBar}
            height={height ?? variables.iconBottomBar}
          />
        </View>
        <Text style={[styles.bottomTabBarLabel(isSelected)]}>{label}</Text>
      </PressableWithFeedback>
    </Tooltip>
  );
}

BottomTabBarIcon.displayName = 'bottomTabBarIcon';
export default BottomTabBarIcon;
