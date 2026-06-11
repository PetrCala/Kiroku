import {GlassView, isLiquidGlassAvailable} from 'expo-glass-effect';
import type {ForwardedRef} from 'react';
import React, {forwardRef, useEffect, useRef} from 'react';
// eslint-disable-next-line no-restricted-imports
import {StyleSheet} from 'react-native';
// eslint-disable-next-line no-restricted-imports
import type {GestureResponderEvent, Role, Text, View} from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, {Path} from 'react-native-svg';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';
import {PressableWithoutFeedback} from './Pressable';

// iOS 26 ships the native Liquid Glass material; older iOS and Android do not.
// The value is fixed for the session, so it's evaluated once at module load.
const SUPPORTS_LIQUID_GLASS = isLiquidGlassAvailable();

type FloatingActionButtonProps = {
  /* Callback to fire on request to toggle the FloatingActionButton */
  onPress: (event: GestureResponderEvent | KeyboardEvent | undefined) => void;

  /* Current state (active or not active) of the component */
  isActive: boolean;

  /* An accessibility label for the button */
  accessibilityLabel: string;

  /* An accessibility role for the button */
  role: Role;
};

function FloatingActionButton(
  {onPress, isActive, accessibilityLabel, role}: FloatingActionButtonProps,
  ref: ForwardedRef<HTMLDivElement | View | Text>,
) {
  const theme = useTheme();
  const {appColor, buttonDefaultBG, textLight, colorScheme} = theme;
  const styles = useThemeStyles();
  const fabPressable = useRef<HTMLDivElement | View | Text | null>(null);
  const sharedValue = useSharedValue(isActive ? 1 : 0);
  const buttonRef = ref;

  useEffect(() => {
    // eslint-disable-next-line react-compiler/react-compiler
    sharedValue.value = withTiming(isActive ? 1 : 0, {
      duration: 340,
      easing: Easing.inOut(Easing.ease),
    });
  }, [isActive, sharedValue]);

  // Rotation only — wraps just the icon. The disc is rotationally symmetric, so
  // rotating the icon looks identical to rotating the whole button and lets the
  // glass path keep the rotation without spinning the native glass view.
  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${sharedValue.value * 135}deg`}],
  }));

  // Fallback (non-glass) circle: interpolate the fill from brand yellow to the
  // "close" gray as the popover opens.
  const fallbackAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      sharedValue.value,
      [0, 1],
      [appColor, buttonDefaultBG],
    ),
  }));

  // Glass path: `tintColor` is a plain native prop (not worklet-drivable), so
  // the open state is signalled by cross-fading an opaque gray overlay in over
  // the glass — visually identical to the fallback's color interpolation.
  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sharedValue.value,
  }));

  const icon = (
    <Animated.View style={iconAnimatedStyle}>
      <Svg
        width={variables.iconSizeNormal}
        height={variables.iconSizeNormal}
        viewBox="0 0 20 20">
        <Path
          fill={textLight}
          d="M12,3c0-1.1-0.9-2-2-2C8.9,1,8,1.9,8,3v5H3c-1.1,0-2,0.9-2,2c0,1.1,0.9,2,2,2h5v5c0,1.1,0.9,2,2,2c1.1,0,2-0.9,2-2v-5h5c1.1,0,2-0.9,2-2c0-1.1-0.9-2-2-2h-5V3z"
        />
      </Svg>
    </Animated.View>
  );

  const toggleFabAction = (
    event: GestureResponderEvent | KeyboardEvent | undefined,
  ) => {
    // Drop focus to avoid blue focus ring.
    fabPressable.current?.blur();
    onPress(event);
  };
  return (
    <PressableWithoutFeedback
      ref={el => {
        fabPressable.current = el ?? null;
        if (buttonRef && 'current' in buttonRef) {
          buttonRef.current = el ?? null;
        }
      }}
      accessibilityLabel={accessibilityLabel}
      onPress={toggleFabAction}
      onLongPress={() => {}}
      role={role}
      shouldUseHapticsOnLongPress={false}>
      {SUPPORTS_LIQUID_GLASS ? (
        <GlassView
          glassEffectStyle="regular"
          tintColor={appColor}
          colorScheme={colorScheme}
          style={styles.floatingActionButtonGlass}>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.floatingActionButtonGlassOverlay,
              overlayAnimatedStyle,
            ]}
          />
          {icon}
        </GlassView>
      ) : (
        <Animated.View
          style={[styles.floatingActionButton, fallbackAnimatedStyle]}>
          {icon}
        </Animated.View>
      )}
    </PressableWithoutFeedback>
  );
}

FloatingActionButton.displayName = 'FloatingActionButton';

export default forwardRef(FloatingActionButton);
