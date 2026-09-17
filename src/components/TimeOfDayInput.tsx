import React, {useMemo} from 'react';
import {View} from 'react-native';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {
  clampTimeField,
  getTimeOfDay,
  withTimeOfDay,
} from '@libs/TimeOfDayUtils';
import CONST from '@src/CONST';

type TimeOfDayInputProps = {
  /** The timestamp being edited (ms) */
  value: number;

  /** The timezone the time is read and written in */
  timezone: string;

  /** Called with the new timestamp whenever the hour or minute changes */
  onChange: (value: number) => void;

  /** Label above the pair of fields */
  label: string;

  /** Test id prefix; the fields are `<prefix>-hours` and `<prefix>-minutes` */
  testIDPrefix: string;
};

/**
 * Edit the time of day of a timestamp, keeping its calendar day.
 *
 * Two small numeric fields rather than a platform picker: the day is chosen
 * elsewhere (`SessionDateScreen`), the value being changed here is only ever
 * an hour and a minute, and a wheel picker on one platform and a dialog on
 * another would need two implementations to say the same thing.
 *
 * The hour and minute are read and written **in `timezone`**, not the
 * device's, so editing a session logged in Tokyo from Prague moves the time
 * the user actually sees on the session rather than a converted one.
 */
function TimeOfDayInput({
  value,
  timezone,
  onChange,
  label,
  testIDPrefix,
}: TimeOfDayInputProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  // `toZonedTime` is an Intl-backed (Hermes-slow) call, so the fields read the
  // wall clock once per value change rather than on every render.
  const {hours, minutes} = useMemo(
    () => getTimeOfDay(value, timezone),
    [value, timezone],
  );

  const commit = (nextHours: number, nextMinutes: number) => {
    onChange(withTimeOfDay(value, timezone, nextHours, nextMinutes));
  };

  return (
    <View style={styles.mt2}>
      <Text style={[styles.textLabelSupporting, styles.mb1]}>{label}</Text>
      <View style={[styles.flexRow, styles.alignItemsCenter, styles.gap1]}>
        <View style={styles.flex1}>
          <TextInput
            value={String(hours).padStart(2, '0')}
            onChangeText={text => commit(clampTimeField(text, 23), minutes)}
            keyboardType={CONST.KEYBOARD_TYPE.NUMBER_PAD}
            maxLength={2}
            selectTextOnFocus
            accessibilityLabel={translate('sessionTimesScreen.hours')}
            testID={`${testIDPrefix}-hours`}
          />
        </View>
        <Text style={styles.textHeadlineH2}>:</Text>
        <View style={styles.flex1}>
          <TextInput
            value={String(minutes).padStart(2, '0')}
            onChangeText={text => commit(hours, clampTimeField(text, 59))}
            keyboardType={CONST.KEYBOARD_TYPE.NUMBER_PAD}
            maxLength={2}
            selectTextOnFocus
            accessibilityLabel={translate('sessionTimesScreen.minutes')}
            testID={`${testIDPrefix}-minutes`}
          />
        </View>
      </View>
    </View>
  );
}

export default TimeOfDayInput;
export type {TimeOfDayInputProps};
