import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {StyleSheet, View} from 'react-native';
import useTheme from '@hooks/useTheme';
import Text from './Text';

/** Counts above this render as "99+" so the pill stays small. */
const MAX_DISPLAYED_COUNT = 99;

const localStyles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});

type CountBadgeProps = {
  /** The number to show. Callers render the badge only when it's above zero. */
  count: number;

  /** Positioning overrides (e.g. absolute placement over an icon) */
  style?: StyleProp<ViewStyle>;
};

/** Small pill with a count, used for pending friend requests. */
function CountBadge({count, style}: CountBadgeProps) {
  const theme = useTheme();
  return (
    <View
      style={[localStyles.badge, {backgroundColor: theme.success}, style]}
      accessible={false}>
      <Text style={[localStyles.badgeText, {color: theme.textLight}]}>
        {count > MAX_DISPLAYED_COUNT ? `${MAX_DISPLAYED_COUNT}+` : count}
      </Text>
    </View>
  );
}

CountBadge.displayName = 'CountBadge';

export default CountBadge;
