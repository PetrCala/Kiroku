import React, {useCallback} from 'react';
import {StyleSheet} from 'react-native';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useStatsContext from '@hooks/useStatsContext';
import useTheme from '@hooks/useTheme';

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});

/**
 * Tab-level filter chip for the Patterns-tab timing charts (hour-of-day,
 * dow×hour, session duration). Filled when `liveOnly` is on (the default): the
 * charts then exclude manually-logged sessions, whose timestamps are synthetic
 * and whose duration is always zero. Tapping it toggles the shared `liveOnly`
 * state, so every timing chart switches together.
 */
function SessionTypeToggle() {
  const {translate} = useLocalize();
  const {appColor, border, text, textReversed} = useTheme();
  const {liveOnly, setLiveOnly} = useStatsContext();

  const toggle = useCallback(() => {
    setLiveOnly(!liveOnly);
  }, [liveOnly, setLiveOnly]);

  return (
    <PressableWithFeedback
      accessibilityLabel={translate(
        'statistics.filters.a11y.sessionTypeToggle',
      )}
      accessibilityRole="button"
      accessibilityState={{selected: liveOnly}}
      onPress={toggle}
      style={[
        styles.pill,
        {
          backgroundColor: liveOnly ? appColor : 'transparent',
          borderColor: liveOnly ? appColor : border,
        },
      ]}>
      <Text color={liveOnly ? textReversed : text} fontSize={13}>
        {translate('statistics.filters.sessionType.liveOnly')}
      </Text>
    </PressableWithFeedback>
  );
}

SessionTypeToggle.displayName = 'SessionTypeToggle';

export default SessionTypeToggle;
