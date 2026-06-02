import React from 'react';
import {View} from 'react-native';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import Modal from '@components/Modal';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import {formatBac} from '@libs/BACUtils';
import type {BacEstimate, SessionContribution} from '@libs/BACUtils';
import {findDrinkNameTranslationKey} from '@libs/DataHandling';
import DateUtils from '@libs/DateUtils';
import {roundToTwoDecimalPlaces} from '@libs/NumberUtils';
import CONST from '@src/CONST';
import type {BacDisplayUnit} from '@src/types/onyx';

type BACDetailsModalProps = {
  /** Whether the modal is shown. */
  isVisible: boolean;

  /** The aggregate estimate, including the per-session breakdown. */
  estimate: BacEstimate;

  /** Which unit BAC contributions are displayed in. */
  displayUnit: BacDisplayUnit;

  /** Called when the user dismisses the modal. */
  onClose: () => void;
};

function SessionBlock({
  contribution,
  displayUnit,
}: {
  contribution: SessionContribution;
  displayUnit: BacDisplayUnit;
}) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  const typeLabel = contribution.isEdit
    ? translate('achievementsScreen.bac.details.editSession')
    : translate('achievementsScreen.bac.details.liveSession');

  return (
    <View style={[styles.mb6]}>
      <View
        style={[
          styles.flexRow,
          styles.justifyContentBetween,
          styles.alignItemsCenter,
        ]}>
        <Text style={[styles.textStrong]}>
          {DateUtils.getLocalizedDay(contribution.startTime)}
        </Text>
        <Text style={[styles.textLabelSupporting]}>{typeLabel}</Text>
      </View>

      {contribution.isEdit ? (
        <Text style={[styles.textLabelSupporting, styles.mb2]}>
          {translate('achievementsScreen.bac.details.editNote')}
        </Text>
      ) : null}

      {contribution.drinks.map(drink => (
        <View
          key={`${drink.key}-${drink.volumeMl}-${drink.abv}`}
          style={[styles.flexRow, styles.justifyContentBetween, styles.mt1]}>
          <Text style={[styles.flex1]}>
            {`${translate(findDrinkNameTranslationKey(drink.key))} ×${drink.count}`}
          </Text>
          <Text style={[styles.textLabelSupporting]}>
            {`${drink.volumeMl} ml · ${(drink.abv * 100).toFixed(1)}% · ${roundToTwoDecimalPlaces(drink.grams)} g`}
          </Text>
        </View>
      ))}

      <Text style={[styles.textLabelSupporting, styles.mt2]}>
        {translate('achievementsScreen.bac.details.sessionTotal', {
          grams: roundToTwoDecimalPlaces(contribution.totalGrams),
          bac: formatBac(contribution.peakBac, displayUnit),
        })}
      </Text>
    </View>
  );
}

function BACDetailsModal({
  isVisible,
  estimate,
  displayUnit,
  onClose,
}: BACDetailsModalProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {windowHeight} = useWindowDimensions();

  // The body scrolls within an explicit maxHeight. CONFIRM is used (not
  // CENTERED_SMALL) because it has no swipe PanResponder — that gesture would
  // otherwise swallow the drag before the ScrollView could scroll. The card
  // fades in centered, shows an X, and dismisses on tap-outside.
  const scrollMaxHeight = Math.round(windowHeight * 0.7);

  return (
    <Modal
      isVisible={isVisible}
      type={CONST.MODAL.MODAL_TYPE.CONFIRM}
      onClose={onClose}>
      <View style={styles.w100}>
        <HeaderWithBackButton
          title={translate('achievementsScreen.bac.details.title')}
          shouldShowBackButton={false}
          shouldShowCloseButton
          onCloseButtonPress={onClose}
        />
        <ScrollView
          style={{maxHeight: scrollMaxHeight}}
          contentContainerStyle={[styles.ph5, styles.pb5]}>
          {estimate.contributions.length === 0 ? (
            <Text style={[styles.textLabelSupporting]}>
              {translate('achievementsScreen.bac.noSession')}
            </Text>
          ) : (
            estimate.contributions.map(contribution => (
              <SessionBlock
                key={contribution.sessionId}
                contribution={contribution}
                displayUnit={displayUnit}
              />
            ))
          )}

          {estimate.hasBand ? (
            <Text style={[styles.textLabelSupporting, styles.mb4]}>
              {translate('achievementsScreen.bac.details.bandNote')}
            </Text>
          ) : null}

          <Text style={[styles.textStrong, styles.mt2, styles.mb2]}>
            {translate('achievementsScreen.bac.details.howTitle')}
          </Text>
          <Text style={[styles.textLabelSupporting, styles.mb2]}>
            {translate('achievementsScreen.bac.details.formula')}
          </Text>
          <Text style={[styles.textLabelSupporting]}>
            {translate('achievementsScreen.bac.details.elimination')}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

BACDetailsModal.displayName = 'BACDetailsModal';
export default BACDetailsModal;
