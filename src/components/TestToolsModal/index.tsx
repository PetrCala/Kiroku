import {useCallback, useEffect, useState} from 'react';
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
import StatsPerf from '@libs/StatsPerf';
import type {FeatureOverride} from '@src/types/onyx/FeatureAccessOverrides';
import type {StatsComputeScope} from '@src/types/onyx/StatsPerfDebug';
import * as FeatureAccess from '@userActions/FeatureAccess';
import * as StatsPerfDebug from '@userActions/StatsPerfDebug';
import toggleTestToolsModal from '@userActions/TestTool';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

// Auto = no override (resolver decides); the other two force the state.
const OVERRIDE_OPTIONS: Array<{
  key: 'auto' | FeatureOverride;
  value: FeatureOverride | null;
}> = [
  {key: 'auto', value: null},
  {key: 'locked', value: 'locked'},
  {key: 'unlocked', value: 'unlocked'},
];

// StatsPerf A/B levers — `window` is the current (#1414) behaviour, `full`
// reverts to pre-#1414 so each windowing can be bisected on-device.
const SCOPE_OPTIONS: StatsComputeScope[] = ['window', 'full'];
// How often the modal re-reads the live profiler readout while open.
const STATS_PERF_POLL_MS = 1000;

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
  const [perfDebug] = useOnyx(ONYXKEYS.NVP_STATS_PERF_DEBUG, {
    canBeMissing: true,
  });

  const accent = theme.appColor;
  const featureKeys = getPremiumFeatureKeys();

  // Poll the in-memory profiler readout while the panel is open. The lines live
  // in the StatsPerf module (not Onyx) so this poll never adds Onyx writes that
  // would skew the very `cachedDrinkingSessions`-write count being measured.
  const [perfReport, setPerfReport] = useState<string[]>([]);
  useEffect(() => {
    if (!isVisible) {
      return;
    }
    // Poll only (no synchronous prime) — the first tick lands within a second,
    // which is fine for a debug readout and keeps setState out of the effect body.
    const id = setInterval(
      () => setPerfReport([...StatsPerf.getReportLines()]),
      STATS_PERF_POLL_MS,
    );
    return () => clearInterval(id);
  }, [isVisible]);

  const handleClose = useCallback(() => {
    if (isVisible) {
      toggleTestToolsModal();
    }
  }, [isVisible]);

  const computeScope = perfDebug?.computeScope ?? 'window';
  const backfillScope = perfDebug?.backfillScope ?? 'window';

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
          <Text style={[styles.textNormal, styles.textStrong]}>
            StatsPerf diagnostics
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
                Logging
              </Text>
              <Text style={[styles.textMicroSupporting, styles.mt1]}>
                [StatsPerf] counters + the readout below
              </Text>
            </View>
            <Switch
              accessibilityLabel="StatsPerf logging"
              isOn={perfDebug?.loggingEnabled ?? true}
              onToggle={StatsPerfDebug.setLoggingEnabled}
            />
          </View>

          <Text style={styles.textMicroSupporting}>
            Home compute scope (window = #1414, full = pre)
          </Text>
          <View style={[styles.flexRow, styles.gap2]}>
            {SCOPE_OPTIONS.map(scope => {
              const isActive = computeScope === scope;
              return (
                <PressableWithFeedback
                  key={`compute-${scope}`}
                  accessibilityLabel={`compute ${scope}`}
                  accessibilityState={{selected: isActive}}
                  onPress={() => StatsPerfDebug.setComputeScope(scope)}
                  style={[
                    styles.flex1,
                    styles.alignItemsCenter,
                    styles.p2,
                    StyleUtils.getColorAccentRowStyle(isActive ? accent : null),
                  ]}>
                  <Text
                    style={[
                      styles.textMicro,
                      isActive
                        ? StyleUtils.getColorStyle(accent)
                        : styles.textSupporting,
                    ]}>
                    {scope}
                  </Text>
                </PressableWithFeedback>
              );
            })}
          </View>

          <Text style={styles.textMicroSupporting}>
            Backfill scope (window = #1414, full = pre)
          </Text>
          <View style={[styles.flexRow, styles.gap2]}>
            {SCOPE_OPTIONS.map(scope => {
              const isActive = backfillScope === scope;
              return (
                <PressableWithFeedback
                  key={`backfill-${scope}`}
                  accessibilityLabel={`backfill ${scope}`}
                  accessibilityState={{selected: isActive}}
                  onPress={() => StatsPerfDebug.setBackfillScope(scope)}
                  style={[
                    styles.flex1,
                    styles.alignItemsCenter,
                    styles.p2,
                    StyleUtils.getColorAccentRowStyle(isActive ? accent : null),
                  ]}>
                  <Text
                    style={[
                      styles.textMicro,
                      isActive
                        ? StyleUtils.getColorStyle(accent)
                        : styles.textSupporting,
                    ]}>
                    {scope}
                  </Text>
                </PressableWithFeedback>
              );
            })}
          </View>

          <Text style={styles.textMicroSupporting}>
            Readout (newest at bottom; ⚠️LOOP = runaway re-fires)
          </Text>
          <View style={[styles.p2, styles.gap1]}>
            {perfReport.length === 0 ? (
              <Text style={styles.textMicroSupporting}>
                No activity yet — navigate the app, then reopen.
              </Text>
            ) : (
              perfReport.slice(-14).map(line => (
                <Text key={line} style={styles.textMicroSupporting}>
                  {line}
                </Text>
              ))
            )}
          </View>
          <Button
            small
            text="Clear StatsPerf counters"
            onPress={() => {
              StatsPerfDebug.resetCounters();
              setPerfReport([]);
            }}
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
