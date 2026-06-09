import {GlassView, isLiquidGlassAvailable} from 'expo-glass-effect';
import type {ForwardedRef} from 'react';
import React, {forwardRef, useEffect, useRef} from 'react';
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

// iOS 26 renders true Liquid Glass; older iOS, Android and web fall back to the
// solid circle below. The value is fixed for the session, so evaluate it once.
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
  const {appColor, buttonDefaultBG, textLight} = useTheme();
  const styles = useThemeStyles();
  const borderRadius = styles.floatingActionButton.borderRadius;
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

  // Rotation only — the glass circle stays put while the "+" spins into "×".
  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${sharedValue.value * 135}deg`}],
  }));

  // Solid fallback additionally animates its own background fill.
  const solidStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      sharedValue.value,
      [0, 1],
      [appColor, buttonDefaultBG],
    );

    return {
      transform: [{rotate: `${sharedValue.value * 135}deg`}],
      backgroundColor,
      borderRadius,
    };
  });

  const toggleFabAction = (
    event: GestureResponderEvent | KeyboardEvent | undefined,
  ) => {
    // Drop focus to avoid blue focus ring.
    fabPressable.current?.blur();
    onPress(event);
  };

  const plusIcon = (
    <Svg
      width={variables.iconSizeNormal}
      height={variables.iconSizeNormal}
      viewBox="0 0 20 20">
      <Path
        fill={textLight}
        d="M12,3c0-1.1-0.9-2-2-2C8.9,1,8,1.9,8,3v5H3c-1.1,0-2,0.9-2,2c0,1.1,0.9,2,2,2h5v5c0,1.1,0.9,2,2,2c1.1,0,2-0.9,2-2v-5h5c1.1,0,2-0.9,2-2c0-1.1-0.9-2-2-2h-5V3z"
      />
    </Svg>
  );

  return (
    <PressableWithoutFeedback
      ref={el => {
        fabPressable.current = el ?? null;
        if (buttonRef && 'current' in buttonRef) {
          buttonRef.current = el ?? null;
        }
      }}
      style={[styles.bottomTabBarItem, {transform: [{translateY: -4}]}]}
      accessibilityLabel={accessibilityLabel}
      onPress={toggleFabAction}
      onLongPress={() => {}}
      role={role}
      shouldUseHapticsOnLongPress={false}>
      {SUPPORTS_LIQUID_GLASS ? (
        <GlassView
          style={styles.floatingActionButtonGlass}
          glassEffectStyle="regular"
          isInteractive
          tintColor={isActive ? buttonDefaultBG : appColor}>
          <Animated.View style={rotationStyle}>{plusIcon}</Animated.View>
        </GlassView>
      ) : (
        <Animated.View style={[styles.floatingActionButton, solidStyle]}>
          {plusIcon}
        </Animated.View>
      )}
    </PressableWithoutFeedback>
  );
}

FloatingActionButton.displayName = 'FloatingActionButton';

export default forwardRef(FloatingActionButton);
