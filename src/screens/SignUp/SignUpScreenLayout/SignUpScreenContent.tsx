import React from 'react';
import {StyleSheet, View} from 'react-native';
import FormElement from '@components/FormElement';
// import OfflineIndicator from '@components/OfflineIndicator';
import Text from '@components/Text';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';
import KirokuLogo from '@components/KirokuLogo';
import type {SignUpScreenLayoutProps} from './types';

type SignUpScreenContentProps = Pick<
  SignUpScreenLayoutProps,
  'welcomeText' | 'welcomeHeader'
> & {
  /** The children to show inside the layout */
  children?: React.ReactNode;
};

function SignUpScreenContent({
  welcomeHeader,
  welcomeText,
  children,
}: SignUpScreenContentProps) {
  const {shouldUseNarrowLayout} = useResponsiveLayout();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();

  return (
    <View style={[styles.flex1, styles.signUpScreenLeftContainer]}>
      <View
        style={[
          styles.flex1,
          styles.alignSelfCenter,
          styles.signUpScreenWelcomeFormContainer,
        ]}>
        {/* This empty view creates margin on the top of the sign in form which will shrink and grow depending on if the keyboard is open or not */}
        <View
          style={[
            styles.flexGrow1,
            shouldUseNarrowLayout
              ? styles.signUpScreenContentTopSpacerSmallScreens
              : styles.signUpScreenContentTopSpacer,
          ]}
        />
        <View style={[styles.flexGrow2, styles.mb8]}>
          <FormElement style={[styles.alignSelfStretch]}>
            <View
              style={[
                shouldUseNarrowLayout ? styles.mb8 : styles.mb15,
                shouldUseNarrowLayout
                  ? styles.alignItemsCenter
                  : styles.alignSelfStart,
              ]}>
              <KirokuLogo />
            </View>
            <View style={[styles.signUpScreenWelcomeTextContainer]}>
              {welcomeHeader && (
                <Text
                  style={[
                    styles.loginHeroHeader,
                    StyleUtils.getLineHeightStyle(
                      variables.lineHeightSignInHeroXSmall,
                    ),
                    StyleUtils.getFontSizeStyle(
                      variables.fontSizeSignInHeroXSmall,
                    ),
                    !welcomeText ? styles.mb5 : {},
                    !shouldUseNarrowLayout ? styles.textAlignLeft : {},
                    styles.mb5,
                  ]}>
                  {welcomeHeader}
                </Text>
              )}
              {welcomeText && (
                <Text
                  style={[
                    styles.loginHeroBody,
                    styles.mb5,
                    styles.textNormal,
                    !shouldUseNarrowLayout ? styles.textAlignLeft : {},
                  ]}>
                  {welcomeText}
                </Text>
              )}
            </View>
          </FormElement>
          {/* <View
            style={[
              styles.mb8,
              styles.signUpScreenWelcomeTextContainer,
              styles.alignSelfCenter,
            ]}>
            <OfflineIndicator
              style={[styles.m0, styles.pl0, styles.alignItemsStart]}
            />
          </View> */}
        </View>
        <View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFillObject, styles.justifyContentCenter]}>
          {children}
        </View>
      </View>
    </View>
  );
}

SignUpScreenContent.displayName = 'SignUpScreenContent';

export default SignUpScreenContent;
