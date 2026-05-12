import React, {forwardRef, useState} from 'react';
import useInitialValue from '@hooks/useInitialValue';
import useLocalize from '@hooks/useLocalize';
import TIMEZONES from '@src/TIMEZONES';
import type {SelectedTimezone, Timezone} from '@src/types/onyx/UserData';
import RadioListItem from './SelectionList/RadioListItem';
import SelectionList from './SelectionList';
import type {SelectionListHandle} from './SelectionList/types';

/**
 * We add the current time to the key to fix a bug where the list options don't update unless the key is updated.
 */
const getKey = (text: string): string => `${text}-${new Date().getTime()}`;

type TimezoneSelectProps = {
  /** The initial timezone */
  initialTimezone: Timezone;

  /** Callback when a timezone is selected */
  onSelectedTimezone?: (timezone: SelectedTimezone) => void;
};

const TimezoneSelect = forwardRef(function TimezoneSelect(
  {initialTimezone, onSelectedTimezone}: TimezoneSelectProps,
  ref: React.ForwardedRef<SelectionListHandle>,
) {
  const {translate} = useLocalize();
  const allTimezones = useInitialValue(() =>
    TIMEZONES.filter((tz: string) => !tz.startsWith('Etc/GMT')).map(
      (text: string) => ({
        text,
        keyForList: getKey(text),
        isSelected: text === initialTimezone.selected,
      }),
    ),
  );

  const [timezoneInputText, setTimezoneInputText] = useState('');
  const [timezoneOptions, setTimezoneOptions] = useState(allTimezones);

  const filterShownTimezones = (searchText: string) => {
    setTimezoneInputText(searchText);
    const searchWords = searchText.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    setTimezoneOptions(
      allTimezones.filter(tz =>
        searchWords.every(word =>
          tz.text
            .toLowerCase()
            .replace(/[^a-z0-9]/g, ' ')
            .includes(word),
        ),
      ),
    );
  };

  const handleSelectRow = (item: {
    text: string;
    keyForList: string;
    isSelected: boolean;
  }) => {
    if (!onSelectedTimezone) {
      return;
    }
    onSelectedTimezone(item.text as SelectedTimezone);
  };

  return (
    <SelectionList
      ref={ref}
      headerMessage={
        timezoneInputText.trim() && !timezoneOptions.length
          ? translate('common.noResultsFound')
          : ''
      }
      textInputLabel={translate('timezoneScreen.timezone')}
      textInputValue={timezoneInputText}
      onChangeText={filterShownTimezones}
      onSelectRow={handleSelectRow}
      shouldSingleExecuteRowSelect
      sections={[
        {data: timezoneOptions, isDisabled: initialTimezone.automatic},
      ]}
      initiallyFocusedOptionKey={
        timezoneOptions.find(tz => tz.text === initialTimezone.selected)
          ?.keyForList
      }
      showScrollIndicator
      shouldShowTooltips={false}
      ListItem={RadioListItem}
    />
  );
});

export default TimezoneSelect;
