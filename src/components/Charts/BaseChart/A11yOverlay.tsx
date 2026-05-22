import type {ReactNode} from 'react';
import {View} from 'react-native';

type A11yOverlayProps = {
  accessibilityLabel: string;
  children: ReactNode;
};

/**
 * Wraps a chart canvas with an aggregate accessibility label so VoiceOver /
 * TalkBack can announce it (Skia draws to canvas with no native a11y
 * nodes).
 *
 * v1 emits a single label for the whole chart. Per-point invisible
 * touchables — the Apple Health scrub pattern — will land in Phase D
 * polish. Keeping the component shape stable now means consumers don't
 * have to rewire when that arrives.
 */
function A11yOverlay({accessibilityLabel, children}: A11yOverlayProps) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image">
      {children}
    </View>
  );
}

export default A11yOverlay;
export type {A11yOverlayProps};
