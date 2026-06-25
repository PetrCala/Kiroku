import {useCallback} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import Button from '@components/Button';
import Modal from '@components/Modal';
import {PressableWithFeedback} from '@components/Pressable';
import ScrollView from '@components/ScrollView';
import Switch from '@components/Switch';
import Text from '@components/Text';
import useEnvironment from '@hooks/useEnvironment';
import useLocalize from '@hooks/useLocalize';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {getPremiumFeatureKeys} from '@libs/Entitlements';
import type {FeatureOverride} from '@src/types/onyx/FeatureAccessOverrides';
import * as FeatureAccess from '@userActions/FeatureAccess';
import toggleTestToolsModal from '@userActions/TestTool';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ClientLogs from './ClientLogs';

// Auto = no override (resolver decides); the other two force the state.
const OVERRIDE_OPTIONS: Array<{
  key: 'auto' | FeatureOverride;
  value: FeatureOverride | null;
}> = [
  {key: 'auto', value: null},
  {key: 'locked', value: 'locked'},
  {key: 'unlocked', value: 'unlocked'},
];

/**
 * Developer-only debug panel. Opened via the CustomDevMenu entry
 * (⌘D → Open Test Preferences) or by the four-finger tap gesture wired up in
 * ScreenWrapper. Hosts the premium-feature gating overrides ("Simulate Plus" +
 * per-feature lock/unlock) so the locked/upsell paths are exercisable without a
 * rebuild. Every write is no-op in production (see `@userActions/FeatureAccess`).
 */
function TestToolsModal() {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {environment} = useEnvironment();
  const [isVisible] = useOnyx(ONYXKEYS.IS_TEST_TOOLS_MODAL_OPEN);
  const [overrides] = useOnyx(ONYXKEYS.FEATURE_ACCESS_OVERRIDES, {
    canBeMissing: true,
  });

  const accent = theme.appColor;
  const featureKeys = getPremiumFeatureKeys();

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
      <ScrollView contentContainerStyle={[styles.p5, styles.gap4]}>
        <Text style={styles.textHeadlineH1}>
          {translate('testTools.title')}
        </Text>
        <Text style={[styles.textNormal, styles.textSupporting]}>
          {translate('testTools.intro')}
        </Text>

        <View
          style={[
            styles.flexRow,
            styles.alignItemsCenter,
            styles.justifyContentBetween,
            styles.gap3,
          ]}>
          <View style={styles.flex1}>
            <Text style={[styles.textNormal, styles.textStrong]}>
              {translate('testTools.simulatePlus')}
            </Text>
            <Text style={[styles.textMicroSupporting, styles.mt1]}>
              {translate('testTools.simulatePlusDescription')}
            </Text>
          </View>
          <Switch
            accessibilityLabel={translate('testTools.simulatePlus')}
            isOn={overrides?.simulateSupporter === true}
            onToggle={FeatureAccess.setSimulatedSupporter}
          />
        </View>

        <View style={styles.gap2}>
          <Text style={[styles.textNormal, styles.textStrong]}>
            {translate('testTools.featureOverridesTitle')}
          </Text>
          {featureKeys.map(feature => {
            const current = overrides?.features?.[feature] ?? null;
            return (
              <View key={feature} style={styles.gap1}>
                <Text style={styles.textMicroSupporting}>{feature}</Text>
                <View style={[styles.flexRow, styles.gap2]}>
                  {OVERRIDE_OPTIONS.map(option => {
                    const isActive = current === option.value;
                    return (
                      <PressableWithFeedback
                        key={option.key}
                        accessibilityLabel={translate(
                          `testTools.override.${option.key}` as const,
                        )}
                        accessibilityState={{selected: isActive}}
                        onPress={() =>
                          FeatureAccess.setFeatureOverride(
                            feature,
                            option.value,
                          )
                        }
                        style={[
                          styles.flex1,
                          styles.alignItemsCenter,
                          styles.p2,
                          StyleUtils.getColorAccentRowStyle(
                            isActive ? accent : null,
                          ),
                        ]}>
                        <Text
                          style={[
                            styles.textMicro,
                            isActive
                              ? StyleUtils.getColorStyle(accent)
                              : styles.textSupporting,
                          ]}>
                          {translate(
                            `testTools.override.${option.key}` as const,
                          )}
                        </Text>
                      </PressableWithFeedback>
                    );
                  })}
                </View>
              </View>
            );
          })}
          <Button
            small
            text={translate('testTools.resetOverrides')}
            onPress={FeatureAccess.clearAllFeatureOverrides}
          />
        </View>

        <View style={styles.gap2}>
          <Text style={[styles.textNormal, styles.textSupporting]}>
            {`${translate('testTools.environmentLabel')}: ${environment}`}
          </Text>
          <Text style={[styles.textNormal, styles.textSupporting]}>
            {translate('testTools.howToOpen')}
          </Text>
        </View>

        <ClientLogs />

        <Button
          large
          success
          text={translate('common.close')}
          onPress={handleClose}
        />
      </ScrollView>
    </Modal>
  );
}

TestToolsModal.displayName = 'TestToolsModal';
export default TestToolsModal;
