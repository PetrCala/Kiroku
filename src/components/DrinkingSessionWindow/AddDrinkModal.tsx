import React, {useState} from 'react';
import {View} from 'react-native';
import ConfirmModal from '@components/ConfirmModal';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import DateUtils from '@libs/DateUtils';
import {findDrinkNameTranslationKey} from '@libs/DataHandling';
import {getDrinkServings, isSameServing} from '@libs/SessionEntries';
import type {DrinkServing} from '@libs/SessionEntries';
import type {AddDrinks} from '@hooks/useAddDrinks';
import CONST from '@src/CONST';
import type {DrinkKey} from '@src/types/onyx';
import type {SessionEntryId} from '@src/types/onyx/SessionEntries';
import ChoiceChips from './ChoiceChips';

type AddDrinkModalProps = {
  /** The drink type being added */
  drinkKey: DrinkKey;

  /** The session screen's add function (`useAddDrinks`) */
  onAdd: AddDrinks;

  /** Called when the modal closes, with the added entry when one was added */
  onClose: (added?: {entryId: SessionEntryId; drinkKey: DrinkKey}) => void;
};

/**
 * Log one drink, saying which serving it was and how long ago it happened.
 *
 * The plain "+" on a drink row stays the fast path, one tap for one drink of
 * the assumed serving at this moment. This is for the two things that path
 * cannot express and that a session logged after the fact needs:
 *
 * - **which serving** it was, so a 0.5 l 7% IPA is not counted as a 0.5 l 5%
 *   lager. Picking a non-default serving stamps `volume_ml` and `abv` on the
 *   entry (RFC §4.3), which is what makes the SDU exact rather than assumed.
 * - **when** it was, because people log a round after drinking it. The offsets
 *   are minutes back from now; the entry's `ts` is the drink's own time, which
 *   is why retro-add needs no server concession.
 */
function AddDrinkModal({drinkKey, onAdd, onClose}: AddDrinkModalProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  // Each opening starts from the drink's default serving and "just now": the
  // previous drink's choices are not a prediction of this one's. The caller
  // mounts this fresh per drink (keyed on `drinkKey`), so the initial state is
  // the reset and no effect has to chase the prop.
  const [serving, setServing] = useState<DrinkServing | null>(
    () => getDrinkServings(drinkKey).at(0) ?? null,
  );
  const [minutesAgo, setMinutesAgo] = useState<number>(0);

  const servings = getDrinkServings(drinkKey);
  const defaultServing = servings.at(0);

  const onConfirm = () => {
    const added = onAdd(drinkKey, 1, {
      // Only a serving the user changed is stamped; the default is what a
      // reader assumes anyway, so storing it would say nothing.
      ...(serving && defaultServing && !isSameServing(serving, defaultServing)
        ? {volume_ml: serving.ml, abv: serving.abv}
        : {}),
      ...(minutesAgo > 0
        ? {ts: DateUtils.getServerTime() - minutesAgo * 60_000}
        : {}),
    });
    onClose(added?.entryId ? {entryId: added.entryId, drinkKey} : undefined);
  };

  const servingLabel = (option: DrinkServing) =>
    translate('liveSessionScreen.serving', {
      ml: option.ml,
      abv: Math.round(option.abv * 1000) / 10,
    });

  const offsetLabel = (minutes: number) =>
    minutes === 0
      ? translate('liveSessionScreen.justNow')
      : translate('liveSessionScreen.minutesAgo', {minutes});

  return (
    <ConfirmModal
      success
      title={translate('liveSessionScreen.addDrinkTitle', {
        drink: translate(findDrinkNameTranslationKey(drinkKey)),
      })}
      isVisible
      onConfirm={onConfirm}
      onCancel={() => onClose()}
      confirmText={translate('liveSessionScreen.addDrink')}
      cancelText={translate('common.cancel')}
      shouldShowCancelButton
      prompt={
        <View style={styles.w100}>
          <Text style={[styles.textLabelSupporting, styles.mb1]}>
            {translate('liveSessionScreen.servingLabel')}
          </Text>
          <ChoiceChips
            choices={servings.map(option => ({
              value: `${option.ml}-${option.abv}`,
              label: servingLabel(option),
            }))}
            selected={serving ? `${serving.ml}-${serving.abv}` : ''}
            onSelect={value => {
              const picked = servings.find(
                option => `${option.ml}-${option.abv}` === value,
              );
              setServing(picked ?? null);
            }}
            testIDPrefix="add-drink-serving"
          />
          <Text style={[styles.textLabelSupporting, styles.mt3, styles.mb1]}>
            {translate('liveSessionScreen.whenLabel')}
          </Text>
          <ChoiceChips
            choices={CONST.SESSION.RETRO_ADD_OFFSETS_MINUTES.map(minutes => ({
              value: minutes,
              label: offsetLabel(minutes),
            }))}
            selected={minutesAgo}
            onSelect={setMinutesAgo}
            testIDPrefix="add-drink-when"
          />
        </View>
      }
    />
  );
}

export default AddDrinkModal;
export type {AddDrinkModalProps};
