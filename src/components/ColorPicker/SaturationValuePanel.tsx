import React, {useId, useMemo} from 'react';
import {View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {hsvToHex} from '@libs/Color';

const DEFAULT_SIZE = 280;
const THUMB_SIZE = 22;

type SaturationValuePanelProps = {
  /** Current hue (0-360) that fills the panel's base color. */
  hue: number;

  /** Current saturation (0-1); positions the thumb horizontally. */
  saturation: number;

  /** Current value/brightness (0-1); positions the thumb vertically. */
  value: number;

  /** Reports the new (saturation, value) as the user drags, both clamped 0-1. */
  onChange: (saturation: number, value: number) => void;

  /** Square edge length in px. Fixed so the gesture can map touches to s/v. */
  size?: number;
};

/**
 * The saturation/value square of the color picker. The base layer is the pure
 * hue at full S/V; a horizontal white→transparent overlay draws saturation and
 * a vertical transparent→black overlay draws value. A draggable thumb sits at
 * `(s*size, (1-v)*size)`. Works on web and native via react-native-svg +
 * react-native-gesture-handler.
 */
function SaturationValuePanel({
  hue,
  saturation,
  value,
  onChange,
  size = DEFAULT_SIZE,
}: SaturationValuePanelProps) {
  const gradientId = useId().replace(/:/g, '');
  const satGradientId = `sat-${gradientId}`;
  const valGradientId = `val-${gradientId}`;

  const baseColor = hsvToHex({h: hue, s: 1, v: 1});

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(event => {
          'worklet';

          const nextS = Math.max(0, Math.min(1, event.x / size));
          const nextV = Math.max(0, Math.min(1, 1 - event.y / size));
          runOnJS(onChange)(nextS, nextV);
        })
        .onUpdate(event => {
          'worklet';

          const nextS = Math.max(0, Math.min(1, event.x / size));
          const nextV = Math.max(0, Math.min(1, 1 - event.y / size));
          runOnJS(onChange)(nextS, nextV);
        }),
    [size, onChange],
  );

  const thumbLeft = saturation * size - THUMB_SIZE / 2;
  const thumbTop = (1 - value) * size - THUMB_SIZE / 2;
  // Keep the thumb ring readable on both bright and dark swatches.
  const thumbColor = hsvToHex({h: hue, s: saturation, v: value});

  return (
    <GestureDetector gesture={panGesture}>
      <View style={{width: size, height: size}}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient
              id={satGradientId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
            <LinearGradient
              id={valGradientId}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%">
              <Stop offset="0%" stopColor="#000000" stopOpacity={0} />
              <Stop offset="100%" stopColor="#000000" stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={size}
            height={size}
            rx={12}
            fill={baseColor}
          />
          <Rect
            x={0}
            y={0}
            width={size}
            height={size}
            rx={12}
            fill={`url(#${satGradientId})`}
          />
          <Rect
            x={0}
            y={0}
            width={size}
            height={size}
            rx={12}
            fill={`url(#${valGradientId})`}
          />
        </Svg>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: thumbLeft,
            top: thumbTop,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: THUMB_SIZE / 2,
            borderWidth: 3,
            borderColor: '#FFFFFF',
            backgroundColor: thumbColor,
            // A second outline keeps the white ring visible on light swatches.
            shadowColor: '#000000',
            shadowOpacity: 0.35,
            shadowRadius: 2,
            shadowOffset: {width: 0, height: 1},
            elevation: 2,
          }}
        />
      </View>
    </GestureDetector>
  );
}

SaturationValuePanel.displayName = 'SaturationValuePanel';

export default SaturationValuePanel;
