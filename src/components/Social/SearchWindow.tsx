import {Keyboard, View} from 'react-native';
import {useEffect, useCallback} from 'react';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import Button from '@components/Button';
import useThemeStyles from '@hooks/useThemeStyles';
import TextInput from '@components/TextInput';
import useLocalize from '@hooks/useLocalize';
import useDebouncedState from '@hooks/useDebouncedState';

type SearchWindowProps = {
  windowText: string;
  onSearch: (searchText: string) => Promise<void> | void;
  onResetSearch: () => void;
  searchOnTextChange?: boolean;
};

function SearchWindow({
  windowText,
  onSearch,
  onResetSearch,
  searchOnTextChange,
}: SearchWindowProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const [searchText, debouncedSearchText, setSearchText] =
    useDebouncedState<string>('');

  const handleDoSearch = useCallback(
    (text: string) => {
      onSearch(text);
      if (!searchOnTextChange) {
        Keyboard.dismiss();
      }
    },
    [onSearch, searchOnTextChange],
  );

  const handleResetSearch = () => {
    onResetSearch();
    setSearchText('');
  };

  useEffect(() => {
    if (!searchOnTextChange) {
      return;
    }

    handleDoSearch(debouncedSearchText);
    // Including the handleDoSearch function causes an infinite loop
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
  }, [debouncedSearchText, searchOnTextChange]);

  // useImperativeHandle(parentRef, () => ({
  //   focus: () => {
  //     inputRef.current?.focus();
  //   },
  // }));

  return (
    <View style={styles.searchWindowContainer}>
      <View style={styles.searchWindowTextContainer}>
        <TextInput
          accessibilityLabel={translate('textInput.accessibilityLabel')}
          placeholder={windowText}
          value={searchText}
          iconLeft={KirokuIcons.Search}
          onChangeText={text => setSearchText(text)}
          shouldShowClearButton
          containerStyles={styles.flexGrow1}
          hideFocusedState
          textInputContainerStyles={styles.noBorder}
          onClear={handleResetSearch}
        />
      </View>
      {!searchOnTextChange && (
        <Button
          success
          onPress={() => handleDoSearch(searchText)}
          text={translate('common.search')}
          style={[styles.borderRadiusSmall, styles.justifyContentCenter]}
        />
      )}
    </View>
  );
}

export default SearchWindow;
