import React, {useEffect, useState} from 'react';
import {AccessibilityInfo, View} from 'react-native';
import type {StyleProp, ViewStyle, TextStyle} from 'react-native';
import * as Animatable from 'react-native-animatable';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useNativeDriver from '@libs/useNativeDriver';
import type IconAsset from '@src/types/utils/IconAsset';
import Icon from './Icon';
import * as KirokuIcons from './Icon/KirokuIcons';
import Text from './Text';

/* eslint-disable @typescript-eslint/naming-convention,react-compiler/react-compiler */

/**
 * Brief celebratory animation shown after a successful Connect / Disconnect on
 * the Connected Accounts screen.
 *
 * - **Link** (~1200 ms): the provider icon slides in from the left and the
 *   user/account icon from the right; they rotate slightly, meet at the
 *   centre, scale up, then fade out. A checkmark scales in at the moment of
 *   the merge and holds until dismissal.
 * - **Unlink** (~1000 ms): the merged pair starts at the centre, then the
 *   provider drifts left and the user/account icon drifts right while
 *   rotating, fading out as they separate. No central success mark — the
 *   separation itself is the visual signal that the link is gone.
 *
 * `react-native-animatable` keyframes are interpolated on the native driver
 * (transforms + opacity only). If the OS has Reduce Motion enabled, the
 * component renders a static centred pair without any motion.
 *
 * Fires `onAnimationEnd` exactly once after the longest animation completes,
 * regardless of motion preference. The host is responsible for the dismissal
 * timing (typically a short delay so the user can read the text, then unmount).
 */

type LinkAnimationProps = {
  /** Whether this is a link (icons converge → checkmark) or unlink (icons separate). */
  mode: 'link' | 'unlink';

  /** Provider-side icon — e.g. Apple, Google. */
  providerIcon: IconAsset;

  /** Translated text shown beneath the animation (e.g. "Apple connected"). */
  text: string;

  /** Whether to render the Apple-style monochrome tint on the provider icon. */
  shouldTintProviderIcon?: boolean;

  /** Called once after the animation completes (or immediately if Reduce Motion is on). */
  onAnimationEnd?: () => void;

  /** Optional container style override. */
  style?: StyleProp<ViewStyle>;

  /** Optional text style override. */
  textStyles?: StyleProp<TextStyle>;
};

const LINK_DURATION_MS = 1200;
const UNLINK_DURATION_MS = 1000;
const ICON_SIZE = 64;
const CHECK_SIZE = 80;

const linkProviderKeyframes: Animatable.CustomAnimation = {
  0: {opacity: 0, translateX: -70, scale: 0.7, rotate: '0deg'},
  0.25: {opacity: 1, translateX: -35, scale: 1, rotate: '15deg'},
  0.55: {opacity: 1, translateX: 0, scale: 1.1, rotate: '0deg'},
  0.7: {opacity: 0, translateX: 0, scale: 0.6, rotate: '-15deg'},
  1: {opacity: 0, translateX: 0, scale: 0.6, rotate: '-15deg'},
};

const linkUserKeyframes: Animatable.CustomAnimation = {
  0: {opacity: 0, translateX: 70, scale: 0.7, rotate: '0deg'},
  0.25: {opacity: 1, translateX: 35, scale: 1, rotate: '-15deg'},
  0.55: {opacity: 1, translateX: 0, scale: 1.1, rotate: '0deg'},
  0.7: {opacity: 0, translateX: 0, scale: 0.6, rotate: '15deg'},
  1: {opacity: 0, translateX: 0, scale: 0.6, rotate: '15deg'},
};

const linkCheckKeyframes: Animatable.CustomAnimation = {
  0: {opacity: 0, scale: 0},
  0.55: {opacity: 0, scale: 0},
  0.72: {opacity: 1, scale: 1.2},
  0.88: {opacity: 1, scale: 1},
  1: {opacity: 1, scale: 1},
};

const unlinkProviderKeyframes: Animatable.CustomAnimation = {
  0: {opacity: 0, translateX: 0, scale: 0.6, rotate: '0deg'},
  0.2: {opacity: 1, translateX: 0, scale: 1, rotate: '0deg'},
  0.65: {opacity: 1, translateX: -45, scale: 1, rotate: '-15deg'},
  1: {opacity: 0, translateX: -75, scale: 0.7, rotate: '-25deg'},
};

const unlinkUserKeyframes: Animatable.CustomAnimation = {
  0: {opacity: 0, translateX: 0, scale: 0.6, rotate: '0deg'},
  0.2: {opacity: 1, translateX: 0, scale: 1, rotate: '0deg'},
  0.65: {opacity: 1, translateX: 45, scale: 1, rotate: '15deg'},
  1: {opacity: 0, translateX: 75, scale: 0.7, rotate: '25deg'},
};

function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (isMounted) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => {
        /* default to false if the platform doesn't support the check */
      });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, []);
  return reduceMotion;
}

function LinkAnimation({
  mode,
  providerIcon,
  text,
  shouldTintProviderIcon = false,
  onAnimationEnd,
  style,
  textStyles,
}: LinkAnimationProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const reduceMotion = useReduceMotion();

  // Static render for users who opted out of motion: skip straight to the
  // "done" state and fire the completion callback on next tick so the host
  // can dismiss us on the same schedule as the animated path.
  useEffect(() => {
    if (!reduceMotion) {
      return;
    }
    onAnimationEnd?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  if (reduceMotion) {
    return (
      <View
        style={[styles.alignItemsCenter, styles.justifyContentCenter, style]}>
        <View
          style={[
            styles.flexRow,
            styles.alignItemsCenter,
            styles.justifyContentCenter,
            {height: ICON_SIZE * 2, gap: 16},
          ]}>
          {mode === 'link' ? (
            <Icon
              src={KirokuIcons.Checkmark}
              width={CHECK_SIZE}
              height={CHECK_SIZE}
              fill={theme.success}
            />
          ) : (
            <>
              <Icon
                src={providerIcon}
                width={ICON_SIZE}
                height={ICON_SIZE}
                fill={shouldTintProviderIcon ? theme.icon : undefined}
              />
              <Icon
                src={KirokuIcons.Profile}
                width={ICON_SIZE}
                height={ICON_SIZE}
                fill={theme.icon}
              />
            </>
          )}
        </View>
        <Text
          style={[styles.mt3, styles.textHeadlineH2, textStyles]}
          accessibilityLabel={text}
          accessibilityLiveRegion="polite">
          {text}
        </Text>
      </View>
    );
  }

  const duration = mode === 'link' ? LINK_DURATION_MS : UNLINK_DURATION_MS;
  const providerKeyframes =
    mode === 'link' ? linkProviderKeyframes : unlinkProviderKeyframes;
  const userKeyframes =
    mode === 'link' ? linkUserKeyframes : unlinkUserKeyframes;
  // Fire onAnimationEnd from the longest-running element: the checkmark on
  // link (holds until the end), the user icon on unlink (last to fade out).
  const onLongestEnd = onAnimationEnd ?? (() => {});

  return (
    <View
      accessibilityLabel={text}
      accessibilityLiveRegion="polite"
      style={[styles.alignItemsCenter, styles.justifyContentCenter, style]}>
      <View
        style={[
          styles.alignItemsCenter,
          styles.justifyContentCenter,
          {height: ICON_SIZE * 2, width: ICON_SIZE * 4},
        ]}>
        <Animatable.View
          animation={providerKeyframes}
          duration={duration}
          easing="ease-in-out"
          useNativeDriver={useNativeDriver}
          style={{position: 'absolute'}}
          onAnimationEnd={mode === 'link' ? undefined : onLongestEnd}>
          <Icon
            src={providerIcon}
            width={ICON_SIZE}
            height={ICON_SIZE}
            fill={shouldTintProviderIcon ? theme.icon : undefined}
          />
        </Animatable.View>
        <Animatable.View
          animation={userKeyframes}
          duration={duration}
          easing="ease-in-out"
          useNativeDriver={useNativeDriver}
          style={{position: 'absolute'}}>
          <Icon
            src={KirokuIcons.Profile}
            width={ICON_SIZE}
            height={ICON_SIZE}
            fill={theme.icon}
          />
        </Animatable.View>
        {mode === 'link' ? (
          <Animatable.View
            animation={linkCheckKeyframes}
            duration={duration}
            easing="ease-out"
            useNativeDriver={useNativeDriver}
            style={{position: 'absolute'}}
            onAnimationEnd={onLongestEnd}>
            <Icon
              src={KirokuIcons.Checkmark}
              width={CHECK_SIZE}
              height={CHECK_SIZE}
              fill={theme.success}
            />
          </Animatable.View>
        ) : null}
      </View>
      <Animatable.Text
        animation="fadeIn"
        // Text appears as the icons settle / start to separate.
        delay={mode === 'link' ? duration * 0.7 : duration * 0.5}
        duration={300}
        useNativeDriver={useNativeDriver}
        style={[styles.mt3, styles.textHeadlineH2, textStyles]}>
        {text || `${translate('common.success')}!`}
      </Animatable.Text>
    </View>
  );
}

LinkAnimation.displayName = 'LinkAnimation';
export default LinkAnimation;
export type {LinkAnimationProps};
