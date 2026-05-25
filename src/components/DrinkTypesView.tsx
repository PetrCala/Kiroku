import {View} from 'react-native';
import type {DrinkingSession, DrinkKey} from '@src/types/onyx';
import useThemeStyles from '@hooks/useThemeStyles';
import useLocalize from '@hooks/useLocalize';
import DrinkData from '@libs/DrinkData';
import * as DS from '@userActions/DrinkingSession';
import * as SessionLocations from '@userActions/SessionLocations';
import {findDrinkNameTranslationKey} from '@libs/DataHandling';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import CONST from '@src/CONST';
import useTheme from '@hooks/useTheme';
import * as KirokuIcons from './Icon/KirokuIcons';
import Icon from './Icon';
import SessionDrinksInputWindow from './Buttons/SessionDrinksInputWindow';
import Button from './Button';
import Text from './Text';

type DrinkTypesViewProps = {
  /** The session to render */
  session: DrinkingSession;
};

function DrinkTypesView({session}: DrinkTypesViewProps) {
  const {translate} = useLocalize();
  const {preferences} = useDatabaseData();
  const {auth, db} = useFirebase();
  const styles = useThemeStyles();
  const theme = useTheme();

  const handleAddDrinks = (drinkKey: DrinkKey, amount: number) => {
    const timestamp = DS.updateDrinks(
      session?.id,
      drinkKey,
      amount,
      CONST.DRINKS.ACTIONS.ADD,
      preferences?.drinks_to_units,
    );
    if (
      timestamp !== undefined &&
      session?.ongoing === true &&
      session.id &&
      preferences?.track_location_during_sessions === true
    ) {
      // Fire-and-forget: capture must never block the drink-add UX.
      // captureForTimestamp swallows its own errors internally; the .catch
      // is a belt-and-suspenders no-op to satisfy no-floating-promises.
      SessionLocations.captureForTimestamp(
        db,
        auth.currentUser,
        session.id,
        timestamp,
      ).catch(() => {});
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
              />
              <SessionDrinksInputWindow
                drinks={session?.drinks}
                drinkKey={drinkKey}
                sessionId={session?.id}
              />
              <Button
                style={[styles.bgTransparent, styles.p1]}
                onPress={() => handleAddDrinks(drinkKey, 1)}
                icon={KirokuIcons.Plus}
                iconFill={theme.text}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default DrinkTypesView;
export type {DrinkTypesViewProps};
