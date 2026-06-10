import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import useEnvironment from '@hooks/useEnvironment';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import AnimatedKirokuLogoSvg from './AnimatedKirokuLogoSvg';
import KirokuLogoSvg from './KirokuLogoSvg';

type KirokuLogoProps = {
  /** Additional styles to add to the component */
  style?: StyleProp<ViewStyle>;

  /**
   * Controls the animated entrance. `undefined` (default) renders the plain
   * static logo. `false` mounts the animated variant armed at progress 0
   * (invisible) so it can start the moment the prop flips to `true` — used by
   * InitialScreen to wait out the boot splash. Latched once per mount.
   */
  shouldPlayAnimation?: boolean;
};

function KirokuLogo({style, shouldPlayAnimation}: KirokuLogoProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const StyleUtils = useStyleUtils();
  const {environment} = useEnvironment();

  const {shouldUseNarrowLayout} = useResponsiveLayout();

  return (
    <View
      style={[
        StyleUtils.getSignUpLogoWidthStyle(shouldUseNarrowLayout, environment),
        StyleUtils.getHeight(
          shouldUseNarrowLayout
            ? variables.signInLogoHeightSmallScreen
            : variables.signInLogoSize,
        ),
        shouldUseNarrowLayout &&
        (environment === CONST.ENVIRONMENT.DEV ||
          environment === CONST.ENVIRONMENT.STAGING)
          ? styles.mr3
          : {},
        style,
      ]}>
      {shouldPlayAnimation === undefined ? (
        <KirokuLogoSvg fill={theme.appLogo} environment={environment} />
      ) : (
        <AnimatedKirokuLogoSvg
          fill={theme.appLogo}
          environment={environment}
          shouldStart={shouldPlayAnimation}
        />
      )}
    </View>
  );
}

KirokuLogo.displayName = 'KirokuLogo';

export default KirokuLogo;
