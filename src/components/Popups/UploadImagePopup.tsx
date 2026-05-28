import CONST from '@src/CONST';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {useEffect, useState} from 'react';
import {View} from 'react-native';
import {useFirebase} from '@context/global/FirebaseContext';
import useThemeStyles from '@hooks/useThemeStyles';
import useLocalize from '@hooks/useLocalize';
import Text from '@components/Text';
import Button from '@components/Button';
import Modal from '@components/Modal';
import Icon from '@components/Icon';
import useTheme from '@hooks/useTheme';

type UploadImagePopupProps = {
  visible: boolean;
  onRequestClose: () => void;
  uploadProgress: string | null;
  uploadOngoing: boolean;
  onUploadFinish: () => void;
};

function UploadImagePopup({
  visible,
  onRequestClose,
  uploadProgress,
  uploadOngoing,
  onUploadFinish,
}: UploadImagePopupProps) {
  const {auth} = useFirebase();
  const {translate} = useLocalize();
  const theme = useTheme();
  const styles = useThemeStyles();
  const user = auth.currentUser;
  const [uploadFinished, setUploadFinished] = useState<boolean>(false);

  const renderUploadWindow = () => {
    return (
      <View style={[styles.flexColumn, styles.alignItemsCenter]}>
        <Text style={[styles.textAlignCenter, styles.mb2]}>
          {translate('imageUpload.uploadingImage')}
        </Text>
        <Text style={[styles.textStrong, styles.mb2]}>{uploadProgress}</Text>
      </View>
    );
  };

  const renderUploadFinishedWindow = () => {
    const handleUploadFinishConfirm = () => {
      setUploadFinished(false);
      onRequestClose();
    };

    return (
      <View>
        <Icon
          src={KirokuIcons.Check}
          additionalStyles={styles.uploadFinishedIcon}
          fill={theme.textLight}
        />
        <Text style={[styles.textAlignCenter, styles.textStrong, styles.mt2]}>
          {translate('imageUpload.uploadFinished')}
        </Text>
        <Text style={[styles.textAlignCenter, styles.mt2]}>
          {translate('imageUpload.pleaseReload')}
        </Text>
        <Button
          onPress={handleUploadFinishConfirm}
          text={translate('common.great')}
          style={[styles.mt2]}
        />
      </View>
    );
  };

  useEffect(() => {
    const updateInfoUponUpload = () => {
      if (!uploadProgress || !user) {
        return;
      }
      if (uploadProgress.includes('100')) {
        setUploadFinished(true);
        onUploadFinish();
      }
    };

    updateInfoUponUpload();
  }, [uploadProgress, onUploadFinish, user]);

  return (
    <Modal
      isVisible={visible}
      type={CONST.MODAL.MODAL_TYPE.CENTERED_SMALL}
      onClose={onRequestClose}>
      <View style={[styles.p4]}>
        {uploadFinished && renderUploadFinishedWindow()}
        {!!uploadOngoing && renderUploadWindow()}
      </View>
    </Modal>
  );
}

export default UploadImagePopup;
