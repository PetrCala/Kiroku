import React from 'react';
import {View} from 'react-native';
import Button from '@components/Button';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import Modal from '@components/Modal';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';

type BACIntroModalProps = {
  /** Whether the intro is shown. */
  isVisible: boolean;

  /** Called when the user taps the primary "Get started" button. */
  onGetStarted: () => void;

  /** Called when the user dismisses the intro (back button / backdrop). */
  onClose: () => void;
};

function BACIntroModal({isVisible, onGetStarted, onClose}: BACIntroModalProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  return (
    <Modal
      isVisible={isVisible}
      type={CONST.MODAL.MODAL_TYPE.CENTERED_UNSWIPEABLE}
      onClose={onClose}
      innerContainerStyle={{flex: 1}}>
      <View style={styles.flex1}>
        <HeaderWithBackButton
          title={translate('achievementsScreen.bac.intro.title')}
          onBackButtonPress={onClose}
        />
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={[styles.ph5, styles.pb5]}>
          <Text style={[styles.mb4]}>
            {translate('achievementsScreen.bac.intro.body1')}
          </Text>
          <Text style={[styles.mb4]}>
            {translate('achievementsScreen.bac.intro.body2')}
          </Text>
          <Text style={[styles.textLabelSupporting]}>
            {translate('achievementsScreen.bac.disclaimer')}
          </Text>
        </ScrollView>
        <View style={[styles.ph5, styles.pb5]}>
          <Button
            success
            large
            text={translate('achievementsScreen.bac.intro.getStarted')}
            onPress={onGetStarted}
          />
        </View>
      </View>
    </Modal>
  );
}

BACIntroModal.displayName = 'BACIntroModal';
export default BACIntroModal;
