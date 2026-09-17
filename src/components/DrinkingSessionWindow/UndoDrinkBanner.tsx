import React, {useEffect} from 'react';
import {View} from 'react-native';
import Button from '@components/Button';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {findDrinkNameTranslationKey} from '@libs/DataHandling';
import CONST from '@src/CONST';
import type {DrinkKey} from '@src/types/onyx';
import type {SessionEntryId} from '@src/types/onyx/SessionEntries';

/** The drink an undo would take back. */
type UndoTarget = {
  entryId: SessionEntryId;
  drinkKey: DrinkKey;
};

type UndoDrinkBannerProps = {
  /** The last added drink, or `null` when there is nothing to undo */
  target: UndoTarget | null;

  /** Take the drink back */
  onUndo: (target: UndoTarget) => void;

  /** Stop offering the undo (the window elapsed, or it was used) */
  onExpire: () => void;
};

/**
 * "Added a beer. Undo" for a few seconds after a drink goes in.
 *
 * A mis-tap used to mean finding the drink in the stepper and pressing minus,
 * which removed whichever drink the bucket heuristic picked. An entry has an
 * id, so undo takes back exactly the drink that was just added
 * (`removeSessionEntry`), and it leaves a tombstone rather than rewriting a
 * count, so it cannot race the watch.
 *
 * The offer expires on its own so it can never be mistaken for a permanent
 * control: past the window, the timeline's per-entry delete is the way back.
 */
function UndoDrinkBanner({target, onUndo, onExpire}: UndoDrinkBannerProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  useEffect(() => {
    if (!target) {
      return;
    }
    const timer = setTimeout(onExpire, CONST.SESSION.UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
    // `onExpire` is stable for the session screen's lifetime; re-arming the
    // timer on every render would keep the banner up indefinitely.
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
  }, [target]);

  if (!target) {
    return null;
  }

  return (
    <View
      testID="undo-drink-banner"
      style={[
        styles.flexRow,
        styles.alignItemsCenter,
        styles.justifyContentCenter,
        styles.ph4,
        styles.pb2,
        styles.gap2,
      ]}>
      <Text style={styles.textLabelSupporting}>
        {translate('liveSessionScreen.addedDrink', {
          drink: translate(findDrinkNameTranslationKey(target.drinkKey)),
        })}
      </Text>
      <Button
        small
        text={translate('liveSessionScreen.undo')}
        onPress={() => onUndo(target)}
        testID="undo-drink-button"
        accessibilityLabel={translate('liveSessionScreen.undo')}
      />
    </View>
  );
}

export default UndoDrinkBanner;
export type {UndoDrinkBannerProps, UndoTarget};
