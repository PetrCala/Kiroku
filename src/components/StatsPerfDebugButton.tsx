import {useCallback} from 'react';
import {StyleSheet} from 'react-native';
import {PressableWithFeedback} from '@components/Pressable';
import Text from '@components/Text';
import useEnvironment from '@hooks/useEnvironment';
import getPlatform from '@libs/getPlatform';
import toggleTestToolsModal from '@userActions/TestTool';
import CONST from '@src/CONST';

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    zIndex: 100000,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(2, 38, 218, 0.85)',
  },
  label: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});

/**
 * Web-only, non-production floating button that opens the Test Tools panel
 * (StatsPerf diagnostics). The four-finger gesture that opens Test Tools on
 * native is impractical with a mouse, so this gives one-click access during the
 * web perf investigation. Mounted once at the app root (`Kiroku.tsx`); renders
 * nothing on native or production. Diagnostic-only — removed with the branch.
 */
function StatsPerfDebugButton() {
  const {isProduction} = useEnvironment();
  const onPress = useCallback(() => toggleTestToolsModal(), []);

  if (isProduction || getPlatform() !== CONST.PLATFORM.WEB) {
    return null;
  }

  return (
    <PressableWithFeedback
      accessibilityLabel="Open StatsPerf diagnostics"
      style={styles.button}
      onPress={onPress}>
      <Text style={styles.label}>⚡︎ Perf</Text>
    </PressableWithFeedback>
  );
}

StatsPerfDebugButton.displayName = 'StatsPerfDebugButton';
export default StatsPerfDebugButton;
