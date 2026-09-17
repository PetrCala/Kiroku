import React, {useState} from 'react';
import {View} from 'react-native';
import ConfirmModal from '@components/ConfirmModal';
import Text from '@components/Text';
import TimeOfDayInput from '@components/TimeOfDayInput';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {findDrinkNameTranslationKey} from '@libs/DataHandling';
import {getDrinkServings, getEntryServing} from '@libs/SessionEntries';
import type {DrinkServing, SessionEntryWithId} from '@libs/SessionEntries';
import * as DS from '@userActions/DrinkingSession';
import CONST from '@src/CONST';
import type {DrinkingSession} from '@src/types/onyx';
import ChoiceChips from './ChoiceChips';

type EditEntryModalProps = {
  /** The entry being edited */
  entry: SessionEntryWithId;

  /** The session the entry belongs to */
  session: DrinkingSession;

  /** Called when the modal closes */
  onClose: () => void;
};

/** How many drinks one entry may stand for, offered as chips. */
const COUNT_CHOICES = [1, 2, 3, 4, 5, 6];

const servingKey = (serving: DrinkServing) => `${serving.ml}-${serving.abv}`;

/**
 * Edit one drink already in the session: how many it stands for, which serving
 * it was, and what time it happened.
 *
 * Every field is absolute, so the `edit_entry` op this produces is safe to
 * replay and safe to coalesce with a later edit of the same entry (RFC §5.1).
 * An edit that changes nothing sends nothing.
 */
function EditEntryModal({entry, session, onClose}: EditEntryModalProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  // Seeded from the entry and never re-synced: the caller mounts this fresh
  // per entry (keyed on its id), so there is no stale prop to chase.
  const [count, setCount] = useState(() => entry.count);
  const [servingId, setServingId] = useState(() => {
    const serving = getEntryServing(entry);
    return serving ? servingKey(serving) : '';
  });
  const [ts, setTs] = useState(() => entry.ts);

  const drinkName = translate(findDrinkNameTranslationKey(entry.key));
  const servings = getDrinkServings(entry.key);
  // The entry's own serving may be one no preset offers (typed on another
  // device, or a preset that has since changed), so it joins the list rather
  // than being silently replaced by the closest one.
  const currentServing = getEntryServing(entry);
  const choices = [...servings];
  if (
    currentServing &&
    !choices.some(option => servingKey(option) === servingKey(currentServing))
  ) {
    choices.unshift(currentServing);
  }

  const onConfirm = () => {
    const picked = choices.find(option => servingKey(option) === servingId);
    DS.editSessionEntry(session.id, entry.id, {
      count,
      ts,
      ...(picked ? {volume_ml: picked.ml, abv: picked.abv} : {}),
    });
    onClose();
  };

  return (
    <ConfirmModal
      success
      title={translate('liveSessionScreen.editDrink')}
      isVisible
      onConfirm={onConfirm}
      onCancel={onClose}
      confirmText={translate('common.save')}
      cancelText={translate('common.cancel')}
      shouldShowCancelButton
      prompt={
        <View style={styles.w100}>
          <Text style={styles.mb2}>{drinkName}</Text>
          <Text style={[styles.textLabelSupporting, styles.mb1]}>
            {translate('liveSessionScreen.countLabel')}
          </Text>
          <ChoiceChips
            choices={COUNT_CHOICES.map(value => ({
              value,
              label: String(value),
            }))}
            selected={count}
            onSelect={setCount}
            testIDPrefix="edit-entry-count"
          />
          <Text style={[styles.textLabelSupporting, styles.mt3, styles.mb1]}>
            {translate('liveSessionScreen.servingLabel')}
          </Text>
          <ChoiceChips
            choices={choices.map(option => ({
              value: servingKey(option),
              label: translate('liveSessionScreen.serving', {
                ml: option.ml,
                abv: Math.round(option.abv * 1000) / 10,
              }),
            }))}
            selected={servingId}
            onSelect={setServingId}
            testIDPrefix="edit-entry-serving"
          />
          <TimeOfDayInput
            value={ts}
            timezone={session.timezone ?? CONST.DEFAULT_TIME_ZONE.selected}
            onChange={setTs}
            label={translate('liveSessionScreen.timeLabel')}
            testIDPrefix="edit-entry-time"
          />
        </View>
      }
    />
  );
}

export default EditEntryModal;
export type {EditEntryModalProps};
