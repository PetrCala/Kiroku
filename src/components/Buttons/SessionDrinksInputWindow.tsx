import React, {useState, useRef, useMemo, useEffect} from 'react';
import {Keyboard, TextInput, View} from 'react-native';
import {sumDrinksOfSingleType} from '@libs/DataHandling';
import * as DSUtils from '@src/libs/DrinkingSessionUtils';
import * as DS from '@userActions/DrinkingSession';
import type {DrinkingSessionId, DrinkKey, DrinksList} from '@src/types/onyx';
import useThemeStyles from '@hooks/useThemeStyles';
import {PressableWithoutFeedback} from '@components/Pressable';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import Log from '@libs/Log';
import CONST from '@src/CONST';

type SessionDrinksInputWindowProps = {
  /** Current session drinks */
  drinks: DrinksList | undefined;

  /** Key of the drinking session */
  drinkKey: DrinkKey;

  /** ID of the drinking session */
  sessionId?: DrinkingSessionId;
};

function SessionDrinksInputWindow({
  drinks,
  drinkKey,
  sessionId,
}: SessionDrinksInputWindowProps) {
  const styles = useThemeStyles();
  const {preferences} = useDatabaseData();
  const [shouldHighlight, setShouldHighlight] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>(
    sumDrinksOfSingleType(drinks, drinkKey).toString(),
  );
  const inputRef = useRef<TextInput>(null);

  /** Given a new numeric value, update the necessary hooks upstream.
   *
   * @param numericValue The value to handle.
   * @returnsvoid, the upstream hooks get updated
   */
  const handleNewNumericValue = (numericValue: number): void => {
    if (!preferences) {
      Log.warn('SessionDrinksInputWindow', 'No preferences');
      return;
    }
    let newValue: number = numericValue;
    if (Number.isNaN(newValue)) {
      newValue = 0;
    }
    const typeSum = parseFloat(inputValue);

    if (newValue === typeSum) {
      return;
    } // Do nothing if the value is the same

    const shouldAdd = newValue > typeSum;
    const numberToModify = Math.abs(newValue - typeSum);
    const action = shouldAdd
      ? CONST.DRINKS.ACTIONS.ADD
      : CONST.DRINKS.ACTIONS.REMOVE;
    DS.updateDrinks(
      sessionId,
      drinkKey,
      numberToModify,
      action,
      preferences.drinks_to_units,
    );
  };

  const handleKeyPress = (event: {nativeEvent: {key: string}}): void => {
    if (!preferences) {
      Log.warn('SessionDrinksInputWindow', 'No preferences or session');
      return;
    }

    let updatedValue = '0';
    const key = event.nativeEvent.key;

    if (key === 'Backspace') {
      if (inputValue.length > 1) {
        updatedValue = inputValue.slice(0, -1); // Longer than 1
      } else {
        updatedValue = '0';
      }
      if (inputValue !== '0') {
        setInputValue(updatedValue);
      }
    } else if (!Number.isNaN(Number(key))) {
      if (inputValue === '0') {
        updatedValue = key;
      } else if (inputValue.length < 2) {
        updatedValue = inputValue + key;
      } else {
        updatedValue = inputValue; // Same value
      }

      // Check that updatedValue is not greater than availableDrinks
      let numericValue = parseFloat(updatedValue);
      if (Number.isNaN(numericValue)) {
        numericValue = 0;
      }

      const inputValueNumeric = parseFloat(inputValue); // In case one digit is already input, adjust the availableDrinks for this digit

      const availableUnits = DSUtils.calculateAvailableUnits(
        drinks,
        preferences.drinks_to_units,
      );

      // if (numericValue > availableUnits + inputValueNumeric) {
      if (numericValue > availableUnits + inputValueNumeric) {
        return; // If the new value is greater than available units, do nothing.
      }

      setInputValue(updatedValue);
    }

    // Update drinks
    const numericValue = parseFloat(updatedValue);
    handleNewNumericValue(numericValue);
  };

  const handleContainerPress = () => {
    if (inputRef.current?.isFocused()) {
      // Hide keyboard
      Keyboard.dismiss();
      inputRef.current.blur();
    } else {
      // Focus keyboard
      inputRef.current?.focus();
    }
  };

  // Update input value when drinks change
  useMemo(() => {
    const newInputValue = sumDrinksOfSingleType(drinks, drinkKey).toString();
    setInputValue(newInputValue);
  }, [drinks, drinkKey]);

  useEffect(() => {
    if (sumDrinksOfSingleType(drinks, drinkKey) > 0) {
      setShouldHighlight(true);
    } else {
      setShouldHighlight(false);
    }
  }, [drinks, drinkKey]);

  if (!preferences) {
    return;
  }

  return (
    <View style={[styles.alignItemsCenter, styles.justifyContentCenter]}>
      <PressableWithoutFeedback
        accessibilityLabel="button"
        onPress={handleContainerPress}
        style={styles.sessionDrinksInputContainer(shouldHighlight)}>
        <TextInput
          accessibilityLabel="Text input field"
          ref={inputRef}
          style={[
            styles.textLarge,
            styles.textAlignCenter,
            styles.textBold,
            shouldHighlight ? styles.textBlack : styles.textPlainColor,
          ]}
          value={inputValue}
          onKeyPress={handleKeyPress}
          keyboardType="numeric"
          caretHidden
          blurOnSubmit
          onSubmitEditing={() => inputRef.current && inputRef.current.blur()} // Hide keyboard
          maxLength={2}
        />
      </PressableWithoutFeedback>
    </View>
  );
}

export default SessionDrinksInputWindow;
