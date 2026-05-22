import {useCallback} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import Button from '@components/Button';
import Modal from '@components/Modal';
import Text from '@components/Text';
import useEnvironment from '@hooks/useEnvironment';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import toggleTestToolsModal from '@userActions/TestTool';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

/**
 * Developer-only debug panel. Opened via the CustomDevMenu entry
 * (⌘D → Open Test Preferences) or by the four-finger tap gesture wired up
 * in ScreenWrapper. Today this is a placeholder — the action and Onyx flag
 * are real but the panel just explains what it's for. Real toggles (feature
 * flags, environment overrides, forced network states, etc.) can be added
 * directly to the View below.
 */
function TestToolsModal() {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {environment} = useEnvironment();
  const [isVisible] = useOnyx(ONYXKEYS.IS_TEST_TOOLS_MODAL_OPEN);

  const handleClose = useCallback(() => {
    if (isVisible) {
      toggleTestToolsModal();
    }
  }, [isVisible]);

  return (
    <Modal
      isVisible={!!isVisible}
      type={CONST.MODAL.MODAL_TYPE.CENTERED_SMALL}
      onClose={handleClose}>
      <View style={[styles.p5, styles.gap4]}>
        <Text style={styles.textHeadlineH1}>
          {translate('testTools.title')}
        </Text>
        <Text style={[styles.textNormal, styles.textSupporting]}>
          {translate('testTools.intro')}
        </Text>
        <Text style={[styles.textNormal, styles.textSupporting]}>
          {translate('testTools.placeholderNotice')}
        </Text>
        <View style={styles.gap2}>
          <Text style={[styles.textNormal, styles.textSupporting]}>
            {`${translate('testTools.environmentLabel')}: ${environment}`}
          </Text>
          <Text style={[styles.textNormal, styles.textSupporting]}>
            {translate('testTools.howToOpen')}
          </Text>
        </View>
        <Button
          large
          success
          text={translate('common.close')}
          onPress={handleClose}
        />
      </View>
    </Modal>
  );
}

TestToolsModal.displayName = 'TestToolsModal';
export default TestToolsModal;
