import React, {useEffect, useState} from 'react';
import {Animated, StyleSheet, View} from 'react-native';
import ArrowIcon from '@components/DatePicker/CalendarPicker/ArrowIcon';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import getStatsRangeLabel from '@libs/StatsRangeLabel';
import type {Range} from '@components/StatsContextProvider/types';
import CONST from '@src/CONST';

const BUTTON_SIZE = 40;
const PILL_AREA_HEIGHT = 30;

const styles = StyleSheet.create({
  container: {
    rowGap: 6,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Fixed-width slots so the arrows stay pinned to the edges regardless of
  // the (variable-width) label between them.
  buttonSlot: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontWeight: '700',
  },
  // Reserve constant vertical space so the layout never jumps when the
  // "jump to latest" pill fades in/out.
  pillArea: {
    height: PILL_AREA_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

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
  const {appColor, text, textReversed, border, buttonDefaultBG} = useTheme();

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

  const buttonStyle = [
    styles.button,
    {borderColor: border, backgroundColor: buttonDefaultBG},
  ];

  return (
    <View style={styles.container}>
      <View style={styles.navRow}>
        <View style={styles.buttonSlot}>
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
              style={buttonStyle}>
              <ArrowIcon
                disabled={!canGoPrev}
                direction={CONST.DIRECTION.LEFT}
              />
            </PressableWithFeedback>
          )}
        </View>
        <PressableWithFeedback
          onPress={onPressLabel}
          accessibilityLabel={translate('statistics.filters.a11y.rangeLabel')}
          accessibilityRole="button"
          style={styles.label}>
          <Text
            color={text}
            fontSize={15}
            style={styles.labelText}
            numberOfLines={1}>
            {label}
          </Text>
        </PressableWithFeedback>
        <View style={styles.buttonSlot}>
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
              style={buttonStyle}>
              <ArrowIcon disabled={!canGoNext} />
            </PressableWithFeedback>
          )}
        </View>
      </View>
      <View style={styles.pillArea} pointerEvents="box-none">
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
            style={[styles.pill, {backgroundColor: appColor}]}>
            <Text color={textReversed} fontSize={12}>
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
