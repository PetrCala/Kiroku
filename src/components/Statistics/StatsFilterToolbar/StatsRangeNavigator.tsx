import React, {useEffect, useState} from 'react';
import {Animated, View} from 'react-native';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useStyleUtils from '@hooks/useStyleUtils';
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
  const StyleUtils = useStyleUtils();
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

  const renderArrow = (enabled: boolean, direction: 'left' | 'right') => (
    <Icon
      small
      src={KirokuIcons.ArrowRight}
      fill={text}
      additionalStyles={[
        StyleUtils.getDirectionStyle(
          direction === 'left' ? CONST.DIRECTION.LEFT : CONST.DIRECTION.RIGHT,
        ),
        enabled ? undefined : styles.statsRangeNavigatorIconDisabled,
      ]}
    />
  );

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
            {renderArrow(canGoPrev, 'left')}
          </PressableWithFeedback>
        )}
      </View>
      <View style={styles.statsRangeNavigatorLabelSlot}>
        <View style={styles.statsRangeNavigatorLabelRow}>
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
          {showJump && (
            <Animated.View style={{opacity: jumpOpacity}}>
              <PressableWithFeedback
                onPress={onJumpToLatest}
                accessibilityLabel={translate(
                  'statistics.filters.a11y.jumpToLatest',
                )}
                accessibilityRole="button"
                style={styles.statsRangeNavigatorInlineJump}>
                <Icon small src={KirokuIcons.RotateLeft} fill={textReversed} />
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
            {renderArrow(canGoNext, 'right')}
          </PressableWithFeedback>
        )}
      </View>
    </View>
  );
}

StatsRangeNavigator.displayName = 'StatsRangeNavigator';

export default StatsRangeNavigator;
