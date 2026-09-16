import React from 'react';
import {View} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import PeriodNavButton from './PeriodNavButton';

type PeriodHeaderProps = {
  /** The period label. A string is set in the shared bold 17pt style; pass a
   *  node to take over the rendering. */
  label: React.ReactNode;

  /** When set, the label becomes a button (with a trailing caret) that calls
   *  this on press. */
  onPressLabel?: () => void;

  /** Screen-reader label for the pressable label; defaults to the label text
   *  when that is a string. */
  labelAccessibilityLabel?: string;

  /** Content of the fixed 24x24 slot before the nav buttons: typically a
   *  revert / jump control or a spinner. The slot keeps its size when empty so
   *  the buttons never shift. */
  sideSlot?: React.ReactNode;

  /** Previous-period handler */
  onPrevious?: () => void;

  /** Next-period handler */
  onNext?: () => void;

  /** Whether the previous button is enabled (defaults to true) */
  canGoPrevious?: boolean;

  /** Whether the next button is enabled (defaults to true) */
  canGoNext?: boolean;

  /** Omit the two nav buttons entirely (the side slot stays) */
  hideNavButtons?: boolean;

  /** Screen-reader label for the previous button; defaults to `common.previous` */
  previousAccessibilityLabel?: string;

  /** Screen-reader label for the next button; defaults to `common.next` */
  nextAccessibilityLabel?: string;

  /** Extra style for the row (e.g. `flex1` or a horizontal inset) */
  style?: StyleProp<ViewStyle>;
};

/**
 * Period-navigation header: the label leads, then a flex spacer, a fixed side
 * slot and two round nav buttons trail. Shared by the compact sessions
 * calendar and the Statistics range navigator so both read the same.
 */
function PeriodHeader({
  label,
  onPressLabel,
  labelAccessibilityLabel,
  sideSlot,
  onPrevious,
  onNext,
  canGoPrevious = true,
  canGoNext = true,
  hideNavButtons = false,
  previousAccessibilityLabel,
  nextAccessibilityLabel,
  style,
}: PeriodHeaderProps) {
  const styles = useThemeStyles();
  const theme = useTheme();

  const labelNode =
    typeof label === 'string' ? (
      <Text style={styles.periodHeaderLabelText} numberOfLines={1}>
        {label}
      </Text>
    ) : (
      label
    );
  const resolvedLabelA11y =
    labelAccessibilityLabel ?? (typeof label === 'string' ? label : '');

  return (
    <View style={[styles.periodHeader, style]}>
      {onPressLabel ? (
        <PressableWithFeedback
          onPress={onPressLabel}
          role={CONST.ROLE.BUTTON}
          accessibilityLabel={resolvedLabelA11y}
          style={styles.periodHeaderLabel}>
          {labelNode}
          <Icon
            src={KirokuIcons.DownArrow}
            fill={theme.textSupporting}
            width={12}
            height={12}
            additionalStyles={styles.periodHeaderCaret}
          />
        </PressableWithFeedback>
      ) : (
        <View style={styles.periodHeaderLabel}>{labelNode}</View>
      )}
      <View style={styles.flex1} />
      <View style={styles.periodHeaderSideSlot}>{sideSlot}</View>
      {!hideNavButtons && (
        <>
          <PeriodNavButton
            direction={CONST.DIRECTION.LEFT}
            onPress={onPrevious}
            disabled={!canGoPrevious}
            accessibilityLabel={previousAccessibilityLabel}
            style={styles.periodHeaderNavButtonGap}
          />
          <PeriodNavButton
            direction={CONST.DIRECTION.RIGHT}
            onPress={onNext}
            disabled={!canGoNext}
            accessibilityLabel={nextAccessibilityLabel}
            style={styles.periodHeaderNavButtonGap}
          />
        </>
      )}
    </View>
  );
}

PeriodHeader.displayName = 'PeriodHeader';

export default PeriodHeader;
export {PeriodNavButton};
export type {PeriodHeaderProps};
