import React from 'react';
import Modal from '@components/Modal';
import SafeAreaConsumer from '@components/SafeAreaConsumer';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import getPlatform from '@libs/getPlatform';
import CONST from '@src/CONST';
import {View, Linking} from 'react-native';
import Text from '@components/Text';

function ForceUpdateModal() {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  const currentPlatform = getPlatform();
  const storeLink =
    currentPlatform === CONST.PLATFORM.ANDROID
      ? CONST.STORE_LINKS.ANDROID
      : CONST.STORE_LINKS.IOS;

  const onPress = () => {
    (async () => {
      if (!storeLink) {
        return;
      }
      await Linking.openURL(storeLink);
    })();
  };

  return (
    <SafeAreaConsumer>
      {() => (
        <Modal
          onClose={() => {}}
          isVisible
          type={CONST.MODAL.MODAL_TYPE.CENTERED}>
          <View style={[styles.fullScreenCenteredContent, styles.p2]}>
            <Text style={styles.textHeadlineXXXLarge}>
              {translate('forceUpdate.heading')}
            </Text>
            <Text
              style={[
                styles.textAlignCenter,
                styles.textLarge,
                styles.p5,
                styles.textPlainColor,
              ]}>
              {translate('forceUpdate.text')}
            </Text>
            {storeLink && (
              <Text style={[styles.textLarge, styles.link]} onPress={onPress}>
                {translate('forceUpdate.link')}
              </Text>
            )}
          </View>
        </Modal>
      )}
    </SafeAreaConsumer>
  );
}

export default ForceUpdateModal;
