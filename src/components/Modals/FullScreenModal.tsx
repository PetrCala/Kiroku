import type {StyleProp, ViewStyle} from 'react-native';
import {StyleSheet, View} from 'react-native';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {useEffect, useState} from 'react';
import Modal from '@components/Modal';
import useThemeStyles from '@hooks/useThemeStyles';
import Button from '@components/Button';
import useTheme from '@hooks/useTheme';
import CONST from '@src/CONST';

type FullScreenModalProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  hideCloseButton?: boolean;
};

function FullScreenModal({
  visible,
  onClose,
  children,
  hideCloseButton = false,
  style,
}: FullScreenModalProps) {
  const [modalVisible, setModalVisible] = useState(visible);
  const theme = useTheme();
  const styles = useThemeStyles();

  useEffect(() => {
    setModalVisible(visible);
  }, [visible]);

  const handleCloseModal = () => {
    setModalVisible(false);
    if (onClose) {
      onClose();
    }
  };

  return (
    <Modal
      type={CONST.MODAL.MODAL_TYPE.CENTERED}
      onClose={handleCloseModal}
      isVisible={modalVisible}
      fullscreen
      shouldUseModalPaddingStyle={false}
      // Paint the surface on the modal container (the always-materialized
      // Reanimated view) rather than a child view. On the New Architecture, RN
      // can flatten a background-only child away, which left the modal
      // see-through; the container is never flattened.
      innerContainerStyle={StyleSheet.flatten([{borderWidth: 0}, style])}
      swipeDirection={['up', 'down']}
      animationIn="fadeIn"
      animationOut="fadeOut">
      <View style={styles.fullScreenCenteredContent}>
        {!hideCloseButton && (
          <Button
            onPress={handleCloseModal}
            icon={KirokuIcons.ThinX}
            iconFill={theme.textLight}
            style={styles.closePageButton}
          />
        )}
        {children}
      </View>
    </Modal>
  );
}

export default FullScreenModal;
