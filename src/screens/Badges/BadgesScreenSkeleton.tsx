import React from 'react';
import {View} from 'react-native';
import {ChartSkeleton} from '@components/Charts/ChartSkeleton';
import ScrollView from '@components/ScrollView';
import Skeleton from '@components/Skeleton';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';

/** Placeholder badge rows to mirror the badge grid's resting height. */
const BADGE_ROW_COUNT = 6;

/**
 * Layout-faithful placeholder shown while the Badges screen's entry transition
 * plays. Mirrors `BadgesContent`: a streak hero tile, a 3-up stat row, and a
 * stack of badge-card rows — all on the shared shimmering `Skeleton` primitive.
 */
function BadgesScreenSkeleton() {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const label = translate('badgesScreen.title');

  return (
    <ScrollView
      style={styles.flex1}
      contentContainerStyle={[styles.p4]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.mb3}>
        <ChartSkeleton variant="kpi" accessibilityLabel={label} />
      </View>
      <View style={styles.mb3}>
        <ChartSkeleton variant="kpiRow" count={3} accessibilityLabel={label} />
      </View>
      <View>
        {Array.from({length: BADGE_ROW_COUNT}, (_value, index) => (
          <Skeleton
            // eslint-disable-next-line react/no-array-index-key
            key={`badge-skeleton-${index}`}
            width="100%"
            height={64}
            radius={12}
            style={styles.mb2}
          />
        ))}
      </View>
    </ScrollView>
  );
}

BadgesScreenSkeleton.displayName = 'Badges Screen Skeleton';
export default BadgesScreenSkeleton;
