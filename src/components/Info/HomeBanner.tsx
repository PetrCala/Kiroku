import {View} from 'react-native';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {PressableWithFeedback} from '@components/Pressable';
import Text from '@components/Text';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

type HomeBannerTone = 'neutral' | 'active';

type HomeBannerProps = {
  /** Primary (top) line — a short label, e.g. "Last session" / "In session". */
  label: string;
  /** Secondary (bottom) line — the detail, e.g. "3 days ago · 4.5 units". */
  detail: string;
  onPress: () => void;
  accessibilityLabel: string;
  /** `active` highlights a live state (in-session) with a danger accent. */
  tone?: HomeBannerTone;
  /** Optional trailing text before the chevron, e.g. "Resume". */
  actionLabel?: string;
};

const DOT_SIZE = 8;

/**
 * Single home-screen banner shared by the in-session ("active") and
 * last-session ("neutral") states. Both render the same card shell + two-line
 * layout, so the banner's footprint is identical regardless of state and the
 * calendar below never shifts position.
 */
function HomeBanner({
  label,
  detail,
  onPress,
  accessibilityLabel,
  tone = 'neutral',
  actionLabel,
}: HomeBannerProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const isActive = tone === 'active';
  const accent = isActive ? theme.danger : theme.appColor;

  return (
    <PressableWithFeedback
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.mv2,
        styles.p4,
        styles.flexRow,
        styles.alignItemsCenter,
        styles.justifyContentBetween,
        {backgroundColor: theme.cardSoftBG, borderRadius: 12},
      ]}>
      <View
        style={[styles.flexRow, styles.alignItemsCenter, styles.flexShrink1]}>
        {isActive ? (
          <View
            style={[
              styles.mr2,
              {
                width: DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: DOT_SIZE / 2,
                backgroundColor: theme.danger,
              },
            ]}
          />
        ) : null}
        <View style={styles.flexShrink1}>
          <Text
            style={[
              styles.textLabelSupporting,
              isActive && [styles.textStrong, {color: theme.danger}],
            ]}
            numberOfLines={1}>
            {label}
          </Text>
          <Text numberOfLines={1}>{detail}</Text>
        </View>
      </View>
      <View style={[styles.flexRow, styles.alignItemsCenter, styles.ml2]}>
        {actionLabel ? (
          <Text style={[styles.textStrong, styles.mr1, {color: accent}]}>
            {actionLabel}
          </Text>
        ) : null}
        <Icon
          src={KirokuIcons.ArrowRight}
          width={16}
          height={16}
          fill={isActive ? theme.danger : theme.icon}
        />
      </View>
    </PressableWithFeedback>
  );
}

export default HomeBanner;
export type {HomeBannerProps, HomeBannerTone};
