import React, {useState} from 'react';
import {View} from 'react-native';
import type {DrinkingSession, DrinkKey} from '@src/types/onyx';
import useThemeStyles from '@hooks/useThemeStyles';
import useLocalize from '@hooks/useLocalize';
import DrinkData from '@libs/DrinkData';
import * as DS from '@userActions/DrinkingSession';
import {findDrinkNameTranslationKey} from '@libs/DataHandling';
import useAddDrinks from '@hooks/useAddDrinks';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import CONST from '@src/CONST';
import useTheme from '@hooks/useTheme';
import {isSchemaV2Session} from '@libs/SessionEntries';
import AddDrinkModal from './DrinkingSessionWindow/AddDrinkModal';
import type {UndoTarget} from './DrinkingSessionWindow/UndoDrinkBanner';
import * as KirokuIcons from './Icon/KirokuIcons';
import Icon from './Icon';
import SessionDrinksInputWindow from './Buttons/SessionDrinksInputWindow';
import Button from './Button';
import Text from './Text';

type DrinkTypesViewProps = {
  /** The session to render */
  session: DrinkingSession;

  /** Called when a drink was added, so the caller can offer to undo it */
  onDrinkAdded?: (target: UndoTarget) => void;
};

function DrinkTypesView({session, onDrinkAdded}: DrinkTypesViewProps) {
  const {translate} = useLocalize();
  const preferences = useCurrentUserPreferences();
  const styles = useThemeStyles();
  const theme = useTheme();
  // The serving/retro-add sheet needs entries to write into. A legacy
  // session's drinks are counts in buckets, with nowhere to put a serving or
  // a time of their own, so it keeps the plain stepper.
  const canPickServing = isSchemaV2Session(session);
  const [addingDrink, setAddingDrink] = useState<DrinkKey | null>(null);

  const handleAddDrinks = useAddDrinks(session);

  const addOneDrink = (drinkKey: DrinkKey) => {
    const added = handleAddDrinks(drinkKey, 1);
    if (added?.entryId) {
      onDrinkAdded?.({entryId: added.entryId, drinkKey});
    }
  };

  const handleRemoveDrinks = (drinkKey: DrinkKey, amount: number) => {
    DS.updateDrinks(
      session?.id,
      drinkKey,
      amount,
      CONST.DRINKS.ACTIONS.REMOVE,
      preferences?.drinks_to_units,
    );
  };

  return (
    <View style={[styles.w100, styles.pb1]}>
      <View
        style={[
          styles.drinkTypesViewTab,
          styles.borderTop,
          styles.borderColorTheme,
        ]}>
        <Text style={styles.headerText}>
          {translate('liveSessionScreen.drinksConsumed')}
        </Text>
      </View>
      <View>
        {DrinkData.map(drink => {
          const drinkKey = drink.key;
          const iconSource = drink.icon;
          const drinkName = translate(findDrinkNameTranslationKey(drinkKey));
          const iconSize = drinkKey === CONST.DRINKS.KEYS.SMALL_BEER ? 22 : 28;

          return (
            <View
              key={drink.key}
              style={[
                styles.pv1,
                styles.mh3,
                styles.flexRow,
                styles.justifyContentCenter,
                styles.alignItemsCenter,
              ]}>
              <View style={styles.drinkTypesViewIconContainer}>
                <Icon
                  fill={theme.text}
                  src={iconSource}
                  height={iconSize}
                  width={iconSize}
                />
              </View>
              <Text style={[styles.flexGrow1, styles.ml1]}>{drinkName}</Text>
              <Button
                style={[styles.bgTransparent, styles.p1]}
                onPress={() => handleRemoveDrinks(drinkKey, 1)}
                icon={KirokuIcons.Minus}
                iconFill={theme.text}
                testID={`remove-drink-${drinkKey}`}
              />
              <SessionDrinksInputWindow
                session={session}
                drinkKey={drinkKey}
                sessionId={session?.id}
              />
              <Button
                style={[styles.bgTransparent, styles.p1]}
                onPress={() => addOneDrink(drinkKey)}
                icon={KirokuIcons.Plus}
                iconFill={theme.text}
                testID={`add-drink-${drinkKey}`}
              />
              {/* The "+" stays the one-tap path for the ordinary drink at
                  this moment; this is the way to say which serving it was or
                  that it happened a while ago. */}
              {!!canPickServing && (
                <Button
                  style={[styles.bgTransparent, styles.p1]}
                  onPress={() => setAddingDrink(drinkKey)}
                  icon={KirokuIcons.ThreeDots}
                  iconFill={theme.text}
                  accessibilityLabel={translate(
                    'liveSessionScreen.drinkOptions',
                    {drink: drinkName},
                  )}
                  testID={`drink-options-${drinkKey}`}
                />
              )}
            </View>
          );
        })}
      </View>
      {/* Mounted fresh per drink type, so the sheet opens on that drink's
          default serving rather than the previous drink's choice. */}
      {!!addingDrink && (
        <AddDrinkModal
          key={addingDrink}
          drinkKey={addingDrink}
          onAdd={handleAddDrinks}
          onClose={added => {
            setAddingDrink(null);
            if (added) {
              onDrinkAdded?.(added);
            }
          }}
        />
      )}
    </View>
  );
}

export default DrinkTypesView;
export type {DrinkTypesViewProps};
