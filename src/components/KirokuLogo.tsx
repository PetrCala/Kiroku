import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import AdHocLogo from '@assets/images/app-logo--adhoc.svg';
import DevLogo from '@assets/images/app-logo--dev.svg';
import ProductionLogo from '@assets/images/app-logo--prod.svg';
import StagingLogo from '@assets/images/app-logo--staging.svg';
import useEnvironment from '@hooks/useEnvironment';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import useTheme from '@hooks/useTheme';
import ImageSVG from './ImageSVG';

type KirokuLogoProps = {
  /** Additional styles to add to the component */
  style?: StyleProp<ViewStyle>;
};

const logoComponents = {
  [CONST.ENVIRONMENT.TEST]: ProductionLogo,
  [CONST.ENVIRONMENT.DEV]: DevLogo,
  [CONST.ENVIRONMENT.STAGING]: StagingLogo,
  [CONST.ENVIRONMENT.PROD]: ProductionLogo,
  [CONST.ENVIRONMENT.ADHOC]: AdHocLogo,
};

function KirokuLogo({style}: KirokuLogoProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const StyleUtils = useStyleUtils();
  const {environment} = useEnvironment();
  // PascalCase is required for React components, so capitalize the const here
  const LogoComponent = logoComponents[environment];

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
      <ImageSVG contentFit="contain" src={LogoComponent} fill={theme.appLogo} />
    </View>
  );
}

KirokuLogo.displayName = 'KirokuLogo';

export default KirokuLogo;
