import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import type {ValueOf} from 'type-fest';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import useLocalize from '@hooks/useLocalize';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';

type PeriodNavButtonProps = {
  /** Which way the arrow points (and which period the press moves to) */
  direction: ValueOf<typeof CONST.DIRECTION>;

  /** Press handler; ignored while disabled */
  onPress?: () => void;

  /** Renders the button dimmed and inert */
  disabled?: boolean;

  /** Screen-reader label; defaults to `common.previous` / `common.next` */
  accessibilityLabel?: string;

  /** Extra style for the pressable (e.g. the gap between two buttons) */
  style?: StyleProp<ViewStyle>;
};

/**
 * Round, outlined previous/next button shared by every period header (the
 * compact sessions calendar, the Statistics range navigator, the date picker
 * modal). 32pt with a 1pt border, holding a 14pt arrow.
 */
function PeriodNavButton({
  direction,
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
}: PeriodNavButtonProps) {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const theme = useTheme();
  const {translate} = useLocalize();
  const isLeft = direction === CONST.DIRECTION.LEFT;

  return (
    <PressableWithFeedback
      onPress={onPress}
      disabled={disabled}
      role={CONST.ROLE.BUTTON}
      accessibilityLabel={
        accessibilityLabel ??
        translate(isLeft ? 'common.previous' : 'common.next')
      }
      style={[
        styles.periodHeaderNavButton,
        disabled && styles.buttonOpacityDisabled,
        style,
      ]}>
      <Icon
        src={KirokuIcons.ArrowRight}
        fill={theme.icon}
        width={14}
        height={14}
        additionalStyles={StyleUtils.getDirectionStyle(direction)}
      />
    </PressableWithFeedback>
  );
}

PeriodNavButton.displayName = 'PeriodNavButton';

export default PeriodNavButton;
export type {PeriodNavButtonProps};
