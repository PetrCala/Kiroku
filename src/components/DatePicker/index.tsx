import {format, parseISO, setYear} from 'date-fns';
import type {ForwardedRef} from 'react';
import React, {forwardRef, useEffect, useState} from 'react';
import {View} from 'react-native';
import Calendar from '@components/DateSelectorModal/Calendar';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import TextInput from '@components/TextInput';
import type {
  BaseTextInputProps,
  BaseTextInputRef,
} from '@components/TextInput/BaseTextInput/types';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import * as FormActions from '@userActions/FormActions';
import CONST from '@src/CONST';
import type {OnyxFormValuesMapping} from '@src/ONYXKEYS';

type DatePickerProps = {
  /**
   * The datepicker supports any value that `new Date()` can parse.
   * `onInputChange` would always be called with a Date (or null)
   */
  value?: string;

  /**
   * The datepicker supports any defaultValue that `new Date()` can parse.
   * `onInputChange` would always be called with a Date (or null)
   */
  defaultValue?: string;

  inputID: string;

  /** A minimum date of calendar to select */
  minDate?: Date;

  /** A maximum date of calendar to select */
  maxDate?: Date;

  /** A function that is passed by FormWrapper */
  onInputChange?: (value: string) => void;

  /** A function that is passed by FormWrapper */
  onTouched?: () => void;

  /** Saves a draft of the input value when used in a form */
  shouldSaveDraft?: boolean;

  /** ID of the wrapping form */
  formID?: keyof OnyxFormValuesMapping;
} & BaseTextInputProps;

function getInitialDate(
  value: string | undefined,
  minDate: Date,
  maxDate: Date,
): Date {
  let date = value ? parseISO(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    date = new Date();
  }
  if (date > maxDate) {
    return maxDate;
  }
  if (date < minDate) {
    return minDate;
  }
  return date;
}

function DatePicker(
  {
    containerStyles,
    defaultValue,
    disabled,
    errorText,
    inputID,
    label,
    maxDate = setYear(new Date(), CONST.CALENDAR_PICKER.MAX_YEAR),
    minDate = setYear(new Date(), CONST.CALENDAR_PICKER.MIN_YEAR),
    onInputChange,
    onTouched,
    placeholder,
    value,
    shouldSaveDraft = false,
    formID,
  }: DatePickerProps,
  ref: ForwardedRef<BaseTextInputRef>,
) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const [selectedDate, setSelectedDate] = useState(
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    value || defaultValue || undefined,
  );
  const commitDate = (date: Date) => {
    const formatted = format(date, CONST.DATE.FNS_FORMAT_STRING);
    onTouched?.();
    onInputChange?.(formatted);
    setSelectedDate(formatted);
  };

  useEffect(() => {
    // Value is provided to input via props and onChange never fires. We have to save draft manually.
    if (shouldSaveDraft && !!formID) {
      FormActions.setDraftValues(formID, {[inputID]: selectedDate});
    }

    if (selectedDate === value || !value) {
      return;
    }

    setSelectedDate(value);
  }, [formID, inputID, selectedDate, shouldSaveDraft, value]);

  return (
    <View style={styles.datePickerRoot}>
      <TextInput
        ref={ref}
        inputID={inputID}
        forceActiveLabel
        icon={KirokuIcons.Calendar}
        label={label}
        accessibilityLabel={label}
        role={CONST.ROLE.PRESENTATION}
        value={selectedDate}
        placeholder={placeholder ?? translate('common.dateFormat')}
        errorText={errorText}
        containerStyles={containerStyles}
        textInputContainerStyles={[styles.borderColorFocus]}
        disabled={disabled}
        readOnly
      />
      <View style={styles.mt3}>
        <Calendar
          mode="single"
          initialDate={getInitialDate(selectedDate, minDate, maxDate)}
          minDate={minDate}
          maxDate={maxDate}
          onChangeSingle={commitDate}
        />
      </View>
    </View>
  );
}

DatePicker.displayName = 'DatePicker';

export default forwardRef(DatePicker);
