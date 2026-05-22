import type {ReactElement} from 'react';
import {View} from 'react-native';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import type {KpiCardProps} from './KpiCard';
import KpiCard from './KpiCard';

type KpiCardGroupProps = {
  cards: KpiCardProps[];
};

/**
 * Renders a responsive grid of KpiCards. 3-up on wider phones / tablets,
 * 2-up on narrow phones. Items wrap onto subsequent rows.
 *
 * Layout uses flexbox row + percentage widths so it gracefully degrades
 * when the card count isn't divisible by the column count.
 */
function KpiCardGroup({cards}: KpiCardGroupProps): ReactElement {
  const styles = useThemeStyles();
  const {shouldUseNarrowLayout} = useResponsiveLayout();
  const columns = shouldUseNarrowLayout ? 2 : 3;
  const widthPercent = `${100 / columns}%` as const;

  return (
    <View style={[styles.flexRow, styles.flexWrap, {marginHorizontal: -4}]}>
      {cards.map((card, idx) => (
        <View
          // eslint-disable-next-line react/no-array-index-key
          key={`kpi-${idx}`}
          style={{
            width: widthPercent,
            paddingHorizontal: 4,
            paddingVertical: 4,
          }}>
          <KpiCard
            label={card.label}
            value={card.value}
            unit={card.unit}
            delta={card.delta}
            sparkline={card.sparkline}
            tone={card.tone}
            onPress={card.onPress}
            accessibilityLabel={card.accessibilityLabel}
          />
        </View>
      ))}
    </View>
  );
}

export default KpiCardGroup;
export type {KpiCardGroupProps};
