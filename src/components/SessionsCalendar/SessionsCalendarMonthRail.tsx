import React, {memo, useState} from 'react';
import {View} from 'react-native';
import Animated, {useAnimatedStyle} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';
import {PressableWithFeedback} from '@components/Pressable';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';

type MonthEntry = {
  /** Calendar month (0-11). */
  month: number;
  /** Calendar year. */
  year: number;
  /** Index of the first WeekRow that contains day-1 of this month. */
  firstWeekIndex: number;
  /** Span of weeks until the next month's firstWeekIndex (last entry covers
   *  the trailing slice up to the end of the list). */
  weekSpan: number;
  /** Short label shown on the rail, e.g. `May 26`. */
  label: string;
};

type SessionsCalendarMonthRailProps = {
  months: MonthEntry[];
  totalWeeks: number;
  /** FlashList vertical offset, fed by a Reanimated scroll handler. */
  scrollY: SharedValue<number>;
  /** Latest known FlashList contentSize.height. */
  contentHeight: SharedValue<number>;
  /** Tapping a month label jumps the parent list to that month's first week. */
  onJumpToWeek?: (weekIndex: number) => void;
};

const HIGHLIGHTER_HEIGHT = 28;

/**
 * Vertical ladder of month/year labels on the right edge of the fullscreen
 * calendar. The list of months stacks chronologically (oldest at top, newest
 * at bottom), each label sized proportionally to the number of weeks in its
 * month so the rail acts as a scroll map of the calendar list.
 *
 * The highlighter chip slides up and down as the user scrolls — its position
 * is driven by a `useSharedValue` that the parent updates via
 * `useAnimatedScrollHandler`, so the animation runs on the UI thread.
 */
function SessionsCalendarMonthRail({
  months,
  totalWeeks,
  scrollY,
  contentHeight,
  onJumpToWeek,
}: SessionsCalendarMonthRailProps) {
  const styles = useThemeStyles();
  const [railHeight, setRailHeight] = useState(0);

  const highlighterStyle = useAnimatedStyle(() => {
    if (contentHeight.value <= 0 || railHeight <= 0) {
      return {opacity: 0, top: 0};
    }
    // Map the list's scroll position into the rail's coordinate space.
    // `contentHeight - viewportApprox` would give the maximum scroll value
    // but the resulting fraction is close enough without that correction.
    const fraction = Math.min(
      1,
      Math.max(0, scrollY.value / contentHeight.value),
    );
    const usableHeight = Math.max(0, railHeight - HIGHLIGHTER_HEIGHT);
    return {
      opacity: 1,
      top: fraction * usableHeight,
    };
  });

  return (
    <View
      style={styles.sessionsCalendarMonthRail}
      onLayout={e => setRailHeight(e.nativeEvent.layout.height)}>
      {months.map(entry => {
        const safeTotal = Math.max(1, totalWeeks);
        return (
          <PressableWithFeedback
            key={`${entry.year}-${entry.month}`}
            accessibilityLabel={entry.label}
            role={CONST.ROLE.BUTTON}
            onPress={() => onJumpToWeek?.(entry.firstWeekIndex)}
            style={[
              styles.sessionsCalendarMonthRailLabel,
              {
                flexGrow: entry.weekSpan / safeTotal,
                flexShrink: 0,
                flexBasis: 0,
              },
            ]}>
            <Text style={styles.sessionsCalendarMonthRailLabelText}>
              {entry.label}
            </Text>
          </PressableWithFeedback>
        );
      })}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sessionsCalendarMonthRailHighlighter,
          {height: HIGHLIGHTER_HEIGHT},
          highlighterStyle,
        ]}
      />
    </View>
  );
}

SessionsCalendarMonthRail.displayName = 'SessionsCalendarMonthRail';
export default memo(SessionsCalendarMonthRail);
export type {MonthEntry, SessionsCalendarMonthRailProps};
