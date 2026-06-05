import React from 'react';
import {View} from 'react-native';
import type {ValueOf} from 'type-fest';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';

type ArrowIconProps = {
  /** Specifies if the arrow icon should be disabled or not. */
  disabled?: boolean;

  /** Specifies direction of icon */
  direction?: ValueOf<typeof CONST.DIRECTION>;

  /** Render at the smaller icon size (to fit denser headers like the stats toolbar) */
  small?: boolean;
};

function ArrowIcon({
  disabled = false,
  direction = CONST.DIRECTION.RIGHT,
  small = false,
}: ArrowIconProps) {
  const theme = useTheme();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  return (
    <View
      style={[
        styles.p1,
        StyleUtils.getDirectionStyle(direction),
        disabled ? styles.buttonOpacityDisabled : {},
      ]}>
      <Icon small={small} fill={theme.icon} src={KirokuIcons.ArrowRight} />
    </View>
  );
}

ArrowIcon.displayName = 'ArrowIcon';

export default ArrowIcon;
