import React, {useCallback, useContext, useEffect, useRef} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import SplashScreenStateContext from '@context/global/SplashScreenStateContext';
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
  const {reportLogoHandoffTarget, isLogoHandoffActive} = useContext(
    SplashScreenStateContext,
  );

  const {shouldUseNarrowLayout} = useResponsiveLayout();

  // Only the animated variant (the InitialScreen logo) takes part in the
  // splash → logo handoff: it reports its on-screen slot so the native splash
  // hider can fly its logo there, and renders settled while that flight runs.
  const isHandoffSlot = shouldPlayAnimation !== undefined;
  const wrapperRef = useRef<View>(null);

  const reportSlot = useCallback(() => {
    if (!isHandoffSlot) {
      return;
    }
    wrapperRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        reportLogoHandoffTarget({x, y, width, height});
      }
    });
  }, [isHandoffSlot, reportLogoHandoffTarget]);

  useEffect(() => {
    if (!isHandoffSlot) {
      return undefined;
    }
    return () => {
      // Clear on unmount so a slot that no longer exists (e.g. authenticated
      // cold boot briefly mounting the public stack) can't make the splash
      // hider fly its logo to a dead position — it falls back to shrink-out.
      reportLogoHandoffTarget(null);
    };
  }, [isHandoffSlot, reportLogoHandoffTarget]);

  return (
    <View
      ref={wrapperRef}
      onLayout={isHandoffSlot ? reportSlot : undefined}
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
          liquidColor={theme.success}
          environment={environment}
          shouldStart={shouldPlayAnimation}
          isHandoff={isLogoHandoffActive}
        />
      )}
    </View>
  );
}

KirokuLogo.displayName = 'KirokuLogo';

export default KirokuLogo;
