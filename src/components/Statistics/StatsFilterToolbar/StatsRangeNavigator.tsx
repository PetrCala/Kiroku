import React, {useEffect, useState} from 'react';
import {Animated} from 'react-native';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import PeriodHeader from '@components/PeriodHeader';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
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
  const {textReversed} = useTheme();

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

  // Side slot: the jump-to-latest button (fades in) or the custom-range revert
  // button. Never both, since a custom range isn't pageable.
  let sideSlot: React.ReactNode = null;
  if (showJump) {
    sideSlot = (
      <Animated.View style={{opacity: jumpOpacity}}>
        <PressableWithFeedback
          onPress={onJumpToLatest}
          role={CONST.ROLE.BUTTON}
          accessibilityLabel={translate('statistics.filters.a11y.jumpToLatest')}
          shouldUseAutoHitSlop
          style={styles.periodHeaderRevert}>
          <Icon
            src={KirokuIcons.RotateLeft}
            fill={textReversed}
            width={14}
            height={14}
          />
        </PressableWithFeedback>
      </Animated.View>
    );
  } else if (showRevert) {
    sideSlot = (
      <PressableWithFeedback
        onPress={onRevert}
        role={CONST.ROLE.BUTTON}
        accessibilityLabel={translate('statistics.filters.a11y.revertToPreset')}
        shouldUseAutoHitSlop
        style={styles.periodHeaderRevert}>
        <Icon
          src={KirokuIcons.RotateLeft}
          fill={textReversed}
          width={14}
          height={14}
        />
      </PressableWithFeedback>
    );
  }

  return (
    <PeriodHeader
      label={label}
      onPressLabel={onPressLabel}
      labelAccessibilityLabel={translate('statistics.filters.a11y.rangeLabel')}
      sideSlot={sideSlot}
      onPrevious={onPrev}
      onNext={onNext}
      canGoPrevious={canGoPrev}
      canGoNext={canGoNext}
      hideNavButtons={!isPageable}
      previousAccessibilityLabel={translate(
        'statistics.filters.a11y.previousPeriod',
      )}
      nextAccessibilityLabel={translate('statistics.filters.a11y.nextPeriod')}
    />
  );
}

StatsRangeNavigator.displayName = 'StatsRangeNavigator';

export default StatsRangeNavigator;
