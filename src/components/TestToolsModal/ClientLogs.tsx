import {useMemo} from 'react';
import {Share, View} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {useOnyx} from 'react-native-onyx';
import Button from '@components/Button';
import ScrollView from '@components/ScrollView';
import Switch from '@components/Switch';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import {clearLogs, setShouldStoreLogs} from '@userActions/Console';
import type {Log} from '@src/types/onyx';
import ONYXKEYS from '@src/ONYXKEYS';

// Debug-only panel — intentionally NOT localized. The whole TestToolsModal is
// gated to non-production builds, so these strings never reach a real user.
// Surfaces the client logs captured into `ONYXKEYS.LOGS` (enabled at launch for
// non-production builds in `src/setup`) so diagnostics that fire before the user
// can reach any menu (e.g. the Apple sign-in provisioning logs) are viewable and
// shareable straight from an ad-hoc device, with no Mac/Xcode tether.

// Diagnostic prefixes that get pulled to the top of the panel for at-a-glance
// reading on-device. Covers the Apple sign-in provisioning path plus the
// onboarding-race instrumentation (the OpenApp dispatch and the gate snapshot).
const MARKERS = [
  'signInWithOAuth',
  'useOnboardingFlow',
  'OnboardingGuard',
  'openApp',
];

function toMillis(time: Log['time']): number {
  const date = time instanceof Date ? time : new Date(time);
  const millis = date.getTime();
  return Number.isNaN(millis) ? 0 : millis;
}

function formatLog(log: Log): string {
  const millis = toMillis(log.time);
  const ts = millis === 0 ? '' : new Date(millis).toISOString();
  let extra = '';
  if (log.extraData !== undefined && log.extraData !== '') {
    try {
      extra =
        typeof log.extraData === 'string'
          ? log.extraData
          : JSON.stringify(log.extraData);
    } catch {
      // JSON.stringify only throws on circular structures; avoid String() on a
      // non-string (it would yield "[object Object]" and trips no-base-to-string).
      extra = '[unserializable extraData]';
    }
  }
  return `${ts} [${log.level}] ${log.message}${extra ? ` ${extra}` : ''}`;
}

function ClientLogs() {
  const styles = useThemeStyles();
  const [logs] = useOnyx(ONYXKEYS.LOGS, {canBeMissing: true});
  const [shouldStoreLogs] = useOnyx(ONYXKEYS.SHOULD_STORE_LOGS, {
    canBeMissing: true,
  });

  const lines = useMemo(() => {
    const entries = Object.values(logs ?? {});
    entries.sort((a, b) => toMillis(a.time) - toMillis(b.time));
    return entries.map(formatLog);
  }, [logs]);

  const text = lines.join('\n');
  // The Apple sign-in / onboarding-race markers are the reason this panel
  // exists — pull them to the top so they're readable on-device without
  // scrolling.
  const markerLines = lines.filter(line =>
    MARKERS.some(marker => line.includes(marker)),
  );

  const onShare = () => {
    if (!text) {
      return;
    }
    Share.share({message: text}).catch(() => {
      // Share sheet dismissed/failed — nothing to recover, this is debug-only.
    });
  };

  const onCopy = () => {
    Clipboard.setString(text);
  };

  return (
    <View style={styles.gap2}>
      <Text style={[styles.textNormal, styles.textStrong]}>
        Client logs (debug)
      </Text>
      <View
        style={[
          styles.flexRow,
          styles.alignItemsCenter,
          styles.justifyContentBetween,
          styles.gap3,
        ]}>
        <Text style={[styles.textMicroSupporting, styles.flex1]}>
          {`Capturing: ${shouldStoreLogs ? 'on' : 'off'} · ${lines.length} entries`}
        </Text>
        <Switch
          accessibilityLabel="Capture client logs"
          isOn={!!shouldStoreLogs}
          onToggle={setShouldStoreLogs}
        />
      </View>

      {markerLines.length > 0 ? (
        <View style={styles.gap1}>
          <Text style={styles.textMicroSupporting}>
            Sign-in / onboarding markers:
          </Text>
          {markerLines.map((line, index) => (
            <Text
              // eslint-disable-next-line react/no-array-index-key
              key={`marker-${index}`}
              style={styles.textMicro}
              selectable>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      <ScrollView
        style={[styles.border, styles.br2, {maxHeight: 160}]}
        contentContainerStyle={styles.p2}>
        <Text style={styles.textMicroSupporting} selectable>
          {text || 'No logs captured yet.'}
        </Text>
      </ScrollView>

      <View style={[styles.flexRow, styles.gap2]}>
        <Button small style={styles.flex1} text="Share" onPress={onShare} />
        <Button small style={styles.flex1} text="Copy" onPress={onCopy} />
        <Button small style={styles.flex1} text="Clear" onPress={clearLogs} />
      </View>
    </View>
  );
}

ClientLogs.displayName = 'ClientLogs';
export default ClientLogs;
