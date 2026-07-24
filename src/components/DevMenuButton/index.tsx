import React from 'react';
import {View} from 'react-native';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import useEnvironment from '@hooks/useEnvironment';
import useLocalize from '@hooks/useLocalize';
import useSafeAreaInsets from '@hooks/useSafeAreaInsets';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import variables from '@styles/variables';
import toggleTestToolsModal from '@userActions/TestTool';
import CONST from '@src/CONST';

/**
 * A small floating button pinned to the top-right corner that opens the Test
 * Tools modal — the tappable equivalent of the existing 4-finger-tap gesture
 * and the native shake-menu "Open Test Preferences" item.
 *
 * Gated to non-production builds: in production `isDevelopment` is false and the
 * component renders nothing, so the button never reaches users. It toggles the
 * same `IS_TEST_TOOLS_MODAL_OPEN` Onyx flag the other triggers use, so the
 * `<TestToolsModal />` mounted in ScreenWrapper picks it up regardless of which
 * screen is on top.
 */
function DevMenuButton() {
  const {isDevelopment} = useEnvironment();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  if (!isDevelopment) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.devMenuButtonContainer,
        {top: insets.top + variables.spacing2},
      ]}>
      <PressableWithFeedback
        accessibilityLabel={translate('testTools.title')}
        role={CONST.ROLE.BUTTON}
        onPress={toggleTestToolsModal}
        style={styles.devMenuButton}>
        <Icon
          src={KirokuIcons.Settings}
          width={variables.iconSizeNormal}
          height={variables.iconSizeNormal}
          fill={theme.icon}
        />
      </PressableWithFeedback>
    </View>
  );
}

DevMenuButton.displayName = 'DevMenuButton';

export default DevMenuButton;
