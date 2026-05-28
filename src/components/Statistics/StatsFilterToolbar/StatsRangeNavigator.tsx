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
  onPressLabel: () => void;
};

function StatsRangeNavigator({
  range,
  onPrev,
  onNext,
  onJumpToLatest,
  onPressLabel,
}: Props) {
  const {translate, preferredLocale} = useLocalize();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {text, textReversed} = useTheme();

  const label = getStatsRangeLabel({range, translate, preferredLocale});
  const {isPageable, canGoPrev, canGoNext, isLatest} = range;

  const showPill = isPageable && !isLatest;
  const [pillOpacity] = useState(() => new Animated.Value(showPill ? 1 : 0));
  useEffect(() => {
    Animated.timing(pillOpacity, {
      toValue: showPill ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [showPill, pillOpacity]);

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
    <View style={styles.statsRangeNavigatorContainer}>
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
        </View>
        <View style={styles.statsRangeNavigatorButtonSlot}>
          {isPageable && (
            <PressableWithFeedback
              shouldUseAutoHitSlop={false}
              disabled={!canGoNext}
              onPress={onNext}
              hoverDimmingValue={1}
              accessibilityLabel={translate(
                'statistics.filters.a11y.nextPeriod',
              )}
              accessibilityState={{disabled: !canGoNext}}
              style={styles.statsRangeNavigatorButton}>
              {renderArrow(canGoNext, 'right')}
            </PressableWithFeedback>
          )}
        </View>
      </View>
      <View style={styles.statsRangeNavigatorPillArea} pointerEvents="box-none">
        <Animated.View
          style={{opacity: pillOpacity}}
          pointerEvents={showPill ? 'auto' : 'none'}>
          <PressableWithFeedback
            onPress={onJumpToLatest}
            disabled={!showPill}
            accessibilityLabel={translate(
              'statistics.filters.a11y.jumpToLatest',
            )}
            accessibilityRole="button"
            style={styles.statsRangeNavigatorPill}>
            <Text color={textReversed} fontSize={13}>
              {translate('statistics.filters.label.jumpToLatest')}
            </Text>
          </PressableWithFeedback>
        </Animated.View>
      </View>
    </View>
  );
}

StatsRangeNavigator.displayName = 'StatsRangeNavigator';

export default StatsRangeNavigator;
