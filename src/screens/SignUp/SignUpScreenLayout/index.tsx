import type {ForwardedRef} from 'react';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
// eslint-disable-next-line no-restricted-imports
import type {ScrollView as RNScrollView} from 'react-native';
import {View} from 'react-native';
import ScrollView from '@components/ScrollView';
import useLocalize from '@hooks/useLocalize';
import usePrevious from '@hooks/usePrevious';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useSafeAreaInsets from '@hooks/useSafeAreaInsets';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import * as Browser from '@libs/Browser';
import variables from '@styles/variables';
import SignUpScreenContent from './SignUpScreenContent';
import scrollViewContentContainerStyles from './signUpScreenStyles';
import type {SignUpScreenLayoutProps, SignUpScreenLayoutRef} from './types';

function SignUpScreenLayout(
  {
    welcomeHeader = '',
    welcomeText = '',
    // navigateFocus = () => {},
    shouldPlayLogoAnimation,
    children,
  }: SignUpScreenLayoutProps,
  ref: ForwardedRef<SignUpScreenLayoutRef>,
) {
  const theme = useTheme();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {preferredLocale} = useLocalize();
  const {top: topInsets, bottom: bottomInsets} = useSafeAreaInsets();
  const scrollViewRef = useRef<RNScrollView>(null);
  const prevPreferredLocale = usePrevious(preferredLocale);
  const {windowHeight} = useWindowDimensions();
  const {shouldUseNarrowLayout} = useResponsiveLayout();

  const {containerStyles, contentContainerStyles} = useMemo(
    () => ({
      containerStyles: shouldUseNarrowLayout
        ? [styles.flex1]
        : [styles.flex1, styles.signUpScreenInner],
      contentContainerStyles: [
        styles.flex1,
        shouldUseNarrowLayout ? styles.flexColumn : styles.flexRow,
      ],
    }),
    [shouldUseNarrowLayout, styles],
  );

  // To scroll on both mobile and web, we need to set the container height manually
  const containerHeight = windowHeight - topInsets - bottomInsets;

  const scrollPageToTop = (animated = false) => {
    if (!scrollViewRef.current) {
      return;
    }
    scrollViewRef.current.scrollTo({y: 0, animated});
  };

  useImperativeHandle(ref, () => ({
    scrollPageToTop,
  }));

  useEffect(() => {
    if (prevPreferredLocale !== preferredLocale) {
      return;
    }

    scrollPageToTop();
  }, [welcomeHeader, welcomeText, prevPreferredLocale, preferredLocale]);

  const scrollViewStyles = useMemo(
    () => scrollViewContentContainerStyles(styles),
    [styles],
  );

  const backgroundImageHeight = Math.max(
    variables.signInContentMinHeight,
    containerHeight,
  );

  return (
    <View style={containerStyles}>
      {!shouldUseNarrowLayout ? (
        <View style={contentContainerStyles}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={[styles.signUpScreenLeftContainerWide, styles.flex1]}
            contentContainerStyle={[styles.flex1]}>
            <SignUpScreenContent
              welcomeHeader={welcomeHeader}
              welcomeText={welcomeText}
              shouldPlayLogoAnimation={shouldPlayLogoAnimation}>
              {children}
            </SignUpScreenContent>
          </ScrollView>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={scrollViewStyles}
          keyboardShouldPersistTaps="handled"
          ref={scrollViewRef}>
          <View
            style={[
              styles.flex1,
              styles.flexColumn,
              Browser.isMobileSafari() ? styles.overflowHidden : {},
              StyleUtils.getMinimumHeight(backgroundImageHeight),
              StyleUtils.getSignInBgStyles(theme),
            ]}>
            <SignUpScreenContent
              welcomeHeader={welcomeHeader}
              welcomeText={welcomeText}
              shouldPlayLogoAnimation={shouldPlayLogoAnimation}>
              {children}
            </SignUpScreenContent>
          </View>
          {/* <View style={[styles.flex0]}>
                <Footer navigateFocus={navigateFocus} />
            </View> */}
        </ScrollView>
      )}
    </View>
  );
}

SignUpScreenLayout.displayName = 'SignUpScreenLayout';

export default forwardRef(SignUpScreenLayout);
