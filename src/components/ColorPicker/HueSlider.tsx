import React, {useId, useMemo} from 'react';
import {View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import {hsvToHex} from '@libs/Color';

const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 24;
const THUMB_SIZE = 28;

// The six hue stops of the spectrum, evenly spaced red→…→red so a full sweep
// covers 0-360°.
const HUE_STOPS = [0, 60, 120, 180, 240, 300, 360];

type HueSliderProps = {
  /** Current hue (0-360); positions the thumb horizontally. */
  hue: number;

  /** Reports the new hue (0-360) as the user drags. */
  onChange: (hue: number) => void;

  /** Track width in px. Fixed so the gesture can map touches to hue. */
  width?: number;

  /** Track height in px. */
  height?: number;
};

/**
 * A horizontal hue slider rendered as an SVG red→yellow→green→cyan→blue→magenta
 * →red gradient with a draggable thumb. Works on web and native via
 * react-native-svg + react-native-gesture-handler.
 */
function HueSlider({
  hue,
  onChange,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: HueSliderProps) {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const gradientId = `hue-${useId().replace(/:/g, '')}`;

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(event => {
          'worklet';

          const nextHue = Math.max(0, Math.min(1, event.x / width)) * 360;
          runOnJS(onChange)(nextHue);
        })
        .onUpdate(event => {
          'worklet';

          const nextHue = Math.max(0, Math.min(1, event.x / width)) * 360;
          runOnJS(onChange)(nextHue);
        }),
    [width, onChange],
  );

  const thumbLeft = (hue / 360) * width - THUMB_SIZE / 2;
  const thumbColor = hsvToHex({h: hue, s: 1, v: 1});

  return (
    <GestureDetector gesture={panGesture}>
      <View
        style={[
          styles.justifyContentCenter,
          StyleUtils.getWidthAndHeightStyle(width, THUMB_SIZE),
        ]}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              {HUE_STOPS.map(stopHue => (
                <Stop
                  key={stopHue}
                  offset={`${(stopHue / 360) * 100}%`}
                  stopColor={hsvToHex({h: stopHue, s: 1, v: 1})}
                  stopOpacity={1}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            rx={height / 2}
            fill={`url(#${gradientId})`}
          />
        </Svg>
        <View
          pointerEvents="none"
          style={[
            styles.colorPickerThumb,
            StyleUtils.getColorPickerThumbStyle(thumbLeft, 0, THUMB_SIZE),
            StyleUtils.getBackgroundColorStyle(thumbColor),
          ]}
        />
      </View>
    </GestureDetector>
  );
}

HueSlider.displayName = 'HueSlider';

export default HueSlider;
