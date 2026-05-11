import useThemeStyles from '@hooks/useThemeStyles';
import React from 'react';
import type {StyleProp, ViewStyle, TextStyle} from 'react-native';
import useNativeDriver from '@libs/useNativeDriver';
import * as Animatable from 'react-native-animatable';
import variables from '@src/styles/variables';
import type IconAsset from '@src/types/utils/IconAsset';
import useTheme from '@hooks/useTheme';
import useLocalize from '@hooks/useLocalize';
import * as KirokuIcons from './Icon/KirokuIcons';
import Icon from './Icon';

/* eslint-disable @typescript-eslint/naming-convention,@typescript-eslint/prefer-nullish-coalescing */

type SuccessAnimationProps = {
  /** The icon asset to display */
  iconSource?: IconAsset;

  /** The text to display below the icon */
  text?: string;

  /** Whether the component is visible and should play the animation */
  visible: boolean;

  /** Callback to fire when the animation ends */
  onAnimationEnd?: () => Promise<void>;

  /** Optional styles to be assigned to the container */
  style?: StyleProp<ViewStyle>;

  /** Optional styles to be assigned to the icon */
  iconStyles?: StyleProp<ViewStyle>;

  /** Optional styles to be assigned to the text */
  textStyles?: StyleProp<TextStyle>;
};

function SuccessAnimation({
  iconSource = KirokuIcons.Checkmark,
  text = '',
  visible,
  onAnimationEnd,
  style,
  iconStyles,
  textStyles,
}: SuccessAnimationProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const defaultText = `${translate('common.success')}!`;

  if (!visible) {
    return null;
  }

  const iconAnimation = {
    0: {opacity: 0, scale: 0},
    0.6: {opacity: 1, scale: 1.1},
    1: {opacity: 1, scale: 1},
  };

  return (
    <Animatable.View
      style={[styles.alignItemsCenter, styles.justifyContentCenter, style]}>
      <Animatable.View
        // eslint-disable-next-line react-compiler/react-compiler
        animation={iconAnimation}
        duration={1000}
        onAnimationEnd={() => {
          if (!onAnimationEnd) {
            return;
          }
          onAnimationEnd();
        }}
        // eslint-disable-next-line react-compiler/react-compiler
        useNativeDriver={useNativeDriver}>
        <Icon
          src={iconSource}
          width={variables.successAnimationIconSize}
          height={variables.successAnimationIconSize}
          fill={theme.success}
          additionalStyles={iconStyles}
        />
      </Animatable.View>
      <Animatable.Text
        animation="fadeIn"
        delay={800}
        useNativeDriver
        style={[styles.mt3, styles.textHeadlineH1, textStyles]}>
        {text ?? defaultText}
      </Animatable.Text>
    </Animatable.View>
  );
}

SuccessAnimation.displayName = 'SuccessAnimation';
export default SuccessAnimation;
