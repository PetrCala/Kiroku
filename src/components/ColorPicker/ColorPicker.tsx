import React, {useCallback, useState} from 'react';
import {View} from 'react-native';
import useThemeStyles from '@hooks/useThemeStyles';
import useStyleUtils from '@hooks/useStyleUtils';
import useWindowDimensions from '@hooks/useWindowDimensions';
import TextInput from '@components/TextInput';
import {hexToHsv, hsvToHex, normalizeHex} from '@libs/Color';
import HueSlider from './HueSlider';
import SaturationValuePanel from './SaturationValuePanel';

type ColorPickerProps = {
  /** The current color as a hex string. Used to seed the editor on mount; remount
   *  (e.g. via a `key`) to reset the picker to a different external color. */
  value: string;

  /** Called with a normalized `#RRGGBB` hex whenever the color changes. */
  onChange: (hex: string) => void;

  /** Label for the hex input (the accessibility fallback). */
  hexInputLabel?: string;

  /** Placeholder for the hex input. */
  hexInputPlaceholder?: string;

  /** Error shown when the typed hex is invalid. */
  hexErrorText?: string;

  /** Override the auto-sized square edge length. */
  size?: number;
};

const FALLBACK_HSV = {h: 0, s: 0, v: 0};

/**
 * A hand-built spectrum color picker: a saturation/value square, a hue slider,
 * a live swatch, and a hex input fallback. HSV is kept as the internal editing
 * source of truth so hue/saturation don't collapse when value or saturation hit
 * zero. Changes are reported through `onChange` as normalized hex; to reflect a
 * new external color, remount the component with a changing `key`.
 */
function ColorPicker({
  value,
  onChange,
  hexInputLabel,
  hexInputPlaceholder,
  hexErrorText,
  size: sizeProp,
}: ColorPickerProps) {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {windowWidth} = useWindowDimensions();
  const size = sizeProp ?? Math.max(200, Math.min(windowWidth - 64, 320));

  const [hue, setHue] = useState(() => (hexToHsv(value) ?? FALLBACK_HSV).h);
  const [saturation, setSaturation] = useState(
    () => (hexToHsv(value) ?? FALLBACK_HSV).s,
  );
  const [brightness, setBrightness] = useState(
    () => (hexToHsv(value) ?? FALLBACK_HSV).v,
  );
  const [hexText, setHexText] = useState(() => normalizeHex(value) ?? value);
  const [hexError, setHexError] = useState(false);

  const handleSaturationValueChange = useCallback(
    (nextSaturation: number, nextValue: number) => {
      setSaturation(nextSaturation);
      setBrightness(nextValue);
      const hex = hsvToHex({h: hue, s: nextSaturation, v: nextValue});
      setHexText(hex);
      setHexError(false);
      onChange(hex);
    },
    [hue, onChange],
  );

  const handleHueChange = useCallback(
    (nextHue: number) => {
      setHue(nextHue);
      const hex = hsvToHex({h: nextHue, s: saturation, v: brightness});
      setHexText(hex);
      setHexError(false);
      onChange(hex);
    },
    [saturation, brightness, onChange],
  );

  const handleHexTextChange = useCallback(
    (text: string) => {
      setHexText(text);
      const normalized = normalizeHex(text);
      if (!normalized) {
        setHexError(true);
        return;
      }
      setHexError(false);
      const parsed = hexToHsv(normalized);
      if (parsed) {
        setHue(parsed.h);
        setSaturation(parsed.s);
        setBrightness(parsed.v);
      }
      onChange(normalized);
    },
    [onChange],
  );

  const currentHex = hsvToHex({h: hue, s: saturation, v: brightness});

  return (
    <View style={styles.alignItemsCenter}>
      <SaturationValuePanel
        hue={hue}
        saturation={saturation}
        value={brightness}
        onChange={handleSaturationValueChange}
        size={size}
      />
      <View style={styles.mt4}>
        <HueSlider hue={hue} onChange={handleHueChange} width={size} />
      </View>
      <View
        style={[
          styles.flexRow,
          styles.alignItemsCenter,
          styles.mt4,
          StyleUtils.getWidthStyle(size),
        ]}>
        <View
          style={[
            styles.colorPickerSwatch,
            StyleUtils.getBackgroundColorStyle(currentHex),
            StyleUtils.getDerivedSwatchBorderStyle(currentHex),
          ]}
        />
        <View style={styles.flex1}>
          <TextInput
            accessibilityLabel={hexInputLabel}
            label={hexInputLabel}
            placeholder={hexInputPlaceholder}
            value={hexText}
            onChangeText={handleHexTextChange}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            errorText={hexError ? hexErrorText : undefined}
          />
        </View>
      </View>
    </View>
  );
}

ColorPicker.displayName = 'ColorPicker';

export default ColorPicker;
