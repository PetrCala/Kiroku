import {
  Image,
  Keyboard,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {useState, forwardRef, useEffect, useRef} from 'react';
import type {Database} from 'firebase/database';
import {useFirebase} from '@src/context/global/FirebaseContext';
import type {SearchWindowRef} from '@src/types/various/Search';
import KeyboardFocusHandler from '@components/Keyboard/KeyboardFocusHandler';
import * as KirokuIcons from '@components/Icon/KirokuIcons';

type SearchWindowProps = {
  windowText: string;
  onSearch: (searchText: string, db?: Database) => void;
  onResetSearch: () => void;
  searchOnTextChange?: boolean;
  styles?: StyleProp<ViewStyle>;
};

const SearchWindow = forwardRef<SearchWindowRef, SearchWindowProps>(
  (
    {windowText, onSearch, onResetSearch, searchOnTextChange, styles},
    parentRef,
  ) => {
    const db = useFirebase().db;
    const [searchText, setSearchText] = useState<string>('');
    const [searchCount, setSearchCount] = useState<number>(0);
    const textInputRef = useRef<TextInput>(null); // Input field ref for focus handling

    const handleDoSearch = (searchText: string, db?: Database): void => {
      onSearch(searchText, db);
      if (!searchOnTextChange) {
        setSearchCount(searchCount + 1);
        Keyboard.dismiss();
      }
    };

    const handleResetSearch = () => {
      onResetSearch();
      setSearchText('');
      setSearchCount(0);
    };

    useEffect(() => {
      if (searchOnTextChange) {
        handleDoSearch(searchText, db);
      }
    }, [searchText]);

    // useImperativeHandle(parentRef, () => ({
    //   focus: () => {
    //     inputRef.current?.focus();
    //   },
    // }));

    return (
      <View style={localStyles.mainContainer}>
        <View
          style={
            searchOnTextChange
              ? [localStyles.textContainer, localStyles.responsiveTextContainer]
              : localStyles.textContainer
          }>
          <KeyboardFocusHandler>
            <TextInput
              accessibilityLabel="Text input field"
              placeholder={windowText}
              placeholderTextColor={'#a8a8a8'}
              value={searchText}
              onChangeText={text => setSearchText(text)}
              style={localStyles.searchText}
              keyboardType="default"
              textContentType="nickname"
              ref={textInputRef}
            />
          </KeyboardFocusHandler>
          {searchText !== '' || searchCount > 0 ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleResetSearch}
              style={localStyles.searchTextResetContainer}>
              <Image
                style={localStyles.searchTextResetImage}
                source={KirokuIcons.ThinX}
              />
            </TouchableOpacity>
          ) : null}
        </View>
        {searchOnTextChange ? null : (
          <View style={localStyles.searchButtonContainer}>
            <TouchableOpacity
              accessibilityRole="button"
              style={localStyles.searchButton}
              onPress={() => handleDoSearch(searchText, db)}>
              <Text style={localStyles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  },
);

const localStyles = StyleSheet.create({
  mainContainer: {
    height: 62,
    alignSelf: 'center',
    flexDirection: 'row',
    paddingTop: 10,
    padding: 5,
    backgroundColor: '#ffff99',
  },
  textContainer: {
    width: '80%',
    height: '90%',
    justifyContent: 'flex-start',
    alignContent: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    paddingRight: 5,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 10,
    backgroundColor: 'white',
  },
  responsiveTextContainer: {
    width: '100%',
  },
  searchText: {
    height: '100%',
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // justifyContent: 'space-between',
    paddingLeft: 10,
    color: 'black',
  },
  searchTextResetContainer: {
    width: '10%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchTextResetImage: {
    width: 15,
    height: 15,
    tintColor: 'gray',
  },
  searchButtonContainer: {
    width: '20%',
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  searchButton: {
    width: '95%',
    height: '90%',
    backgroundColor: '#fcf50f',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'black',
    marginLeft: '5%',
  },
  searchButtonText: {
    color: 'black',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default SearchWindow;
