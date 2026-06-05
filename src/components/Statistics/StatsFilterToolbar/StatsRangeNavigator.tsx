import React, {useEffect, useState} from 'react';
import {Animated, View} from 'react-native';
import ArrowIcon from '@components/DatePicker/CalendarPicker/ArrowIcon';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import getStatsRangeLabel from '@libs/StatsRangeLabel';
import type {Range} from '@components/StatsContextProvider/types';
import CONST from '@src/CONST';

type Props = {
  range: Range;
  onPrev: () => void;
  onNext: () => void;
  onJumpToLatest: () => void;
  onRevert: () => void;
  onPressLabel: () => void;
};

function StatsRangeNavigator({
  range,
  onPrev,
  onNext,
  onJumpToLatest,
  onRevert,
  onPressLabel,
}: Props) {
  const {translate, preferredLocale} = useLocalize();
  const styles = useThemeStyles();
  const {text, textReversed} = useTheme();

  const label = getStatsRangeLabel({range, translate, preferredLocale});
  const {isPageable, canGoPrev, canGoNext, isLatest} = range;

  const showJump = isPageable && !isLatest;
  // The revert button replaces the jump-to-latest button on a custom range
  // (which isn't pageable, so the two never appear together).
  const showRevert = range.preset === 'Custom';
  // Fade the inline jump-to-latest button in whenever it (re)appears.
  const [jumpOpacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!showJump) {
      return;
    }
    jumpOpacity.setValue(0);
    Animated.timing(jumpOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [showJump, jumpOpacity]);

  return (
    <View style={styles.statsRangeNavigatorRow}>
      <View style={styles.statsRangeNavigatorButtonSlot}>
        {isPageable && (
          <PressableWithFeedback
            shouldUseAutoHitSlop={false}
            disabled={!canGoPrev}
            onPress={onPrev}
            hoverDimmingValue={1}
            accessibilityLabel={translate(
              'statistics.filters.a11y.previousPeriod',
            )}
            accessibilityState={{disabled: !canGoPrev}}
            style={styles.statsRangeNavigatorButton}>
            <ArrowIcon
              small
              direction={CONST.DIRECTION.LEFT}
              disabled={!canGoPrev}
            />
          </PressableWithFeedback>
        )}
      </View>
      <View style={styles.statsRangeNavigatorLabelSlot}>
        <View style={styles.statsRangeNavigatorLabelRow}>
          {/* Phantom spacer matching the jump slot on the right, so the label
              stays centered whether or not the jump button is showing. */}
          <View style={styles.statsRangeNavigatorJumpSlot} />
          <PressableWithFeedback
            onPress={onPressLabel}
            accessibilityLabel={translate('statistics.filters.a11y.rangeLabel')}
            accessibilityRole="button"
            style={styles.statsRangeNavigatorLabelPressable}>
            <Text
              color={text}
              fontSize={15}
              style={styles.statsRangeNavigatorLabelText}
              numberOfLines={1}>
              {label}
            </Text>
          </PressableWithFeedback>
          {/* Right slot: a fixed-width reserve keeps the label centered. Holds
              the jump-to-latest button (fades in) or the custom-range revert
              button — never both, since a custom range isn't pageable. */}
          <View style={styles.statsRangeNavigatorJumpSlot}>
            {showJump && (
              <Animated.View style={{opacity: jumpOpacity}}>
                <PressableWithFeedback
                  onPress={onJumpToLatest}
                  accessibilityLabel={translate(
                    'statistics.filters.a11y.jumpToLatest',
                  )}
                  accessibilityRole="button"
                  style={styles.statsRangeNavigatorInlineJump}>
                  <Icon
                    small
                    src={KirokuIcons.RotateLeft}
                    fill={textReversed}
                  />
                </PressableWithFeedback>
              </Animated.View>
            )}
            {showRevert && (
              <PressableWithFeedback
                onPress={onRevert}
                accessibilityLabel={translate(
                  'statistics.filters.a11y.revertToPreset',
                )}
                accessibilityRole="button"
                style={styles.statsRangeNavigatorInlineJump}>
                <Icon small src={KirokuIcons.RotateLeft} fill={textReversed} />
              </PressableWithFeedback>
            )}
          </View>
        </View>
      </View>
      <View style={styles.statsRangeNavigatorButtonSlot}>
        {isPageable && (
          <PressableWithFeedback
            shouldUseAutoHitSlop={false}
            disabled={!canGoNext}
            onPress={onNext}
            hoverDimmingValue={1}
            accessibilityLabel={translate('statistics.filters.a11y.nextPeriod')}
            accessibilityState={{disabled: !canGoNext}}
            style={styles.statsRangeNavigatorButton}>
            <ArrowIcon
              small
              direction={CONST.DIRECTION.RIGHT}
              disabled={!canGoNext}
            />
          </PressableWithFeedback>
        )}
      </View>
    </View>
  );
}

StatsRangeNavigator.displayName = 'StatsRangeNavigator';

export default StatsRangeNavigator;
