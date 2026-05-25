import {View} from 'react-native';
import type {DrinkingSession} from '@src/types/onyx';
import useThemeStyles from '@hooks/useThemeStyles';
import useLocalize from '@hooks/useLocalize';
import DrinkData from '@libs/DrinkData';
import DrinkTypeRow from './DrinkTypeRow';
import Text from './Text';

type DrinkTypesViewProps = {
  /** The session to render */
  session: DrinkingSession;
};

function DrinkTypesView({session}: DrinkTypesViewProps) {
  const {translate} = useLocalize();
  const styles = useThemeStyles();

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
        {DrinkData.map(drink => (
          <DrinkTypeRow key={drink.key} session={session} drink={drink} />
        ))}
      </View>
    </View>
  );
}

export default DrinkTypesView;
export type {DrinkTypesViewProps};
