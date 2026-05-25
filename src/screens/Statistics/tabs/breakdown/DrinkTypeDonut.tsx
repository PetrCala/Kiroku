import {useMemo, useState} from 'react';
import {View} from 'react-native';
import type {GestureResponderEvent} from 'react-native';
import {Canvas, Path, Skia} from '@shopify/react-native-skia';
import PressableWithoutFeedback from '@components/Pressable/PressableWithoutFeedback';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import type {DrinkKey} from '@src/types/onyx/Drinks';
import type {TranslationPaths} from '@src/languages/types';
import {DRINK_KEY_COLORS, DRINK_KEY_ORDER} from './drinkKeyColors';

const DEFAULT_SIZE = 220;
const INNER_RADIUS_RATIO = 0.6;
const SELECTED_LIFT_PX = 4;

const DRINK_LABEL_KEY: Readonly<Record<DrinkKey, TranslationPaths>> = {
  small_beer: 'drinks.smallBeer',
  beer: 'drinks.beer',
  wine: 'drinks.wine',
  weak_shot: 'drinks.weakShot',
  strong_shot: 'drinks.strongShot',
  cocktail: 'drinks.cocktail',
  other: 'drinks.other',
};

type Slice = {
  key: DrinkKey;
  units: number;
  share: number;
  startAngle: number;
  endAngle: number;
};

type DrinkTypeDonutProps = {
  unitsByDrinkKey: ReadonlyMap<DrinkKey, number>;
  /** Set of keys the user has chip-filtered to. Empty Set = all keys. */
  drinkTypeFilter: ReadonlySet<DrinkKey>;
  size?: number;
};

function buildSlices(
  unitsByDrinkKey: ReadonlyMap<DrinkKey, number>,
  drinkTypeFilter: ReadonlySet<DrinkKey>,
): {slices: Slice[]; total: number} {
  const filter = drinkTypeFilter.size === 0 ? null : drinkTypeFilter;
  let total = 0;
  const filtered: Array<{key: DrinkKey; units: number}> = [];
  for (const key of DRINK_KEY_ORDER) {
    if (filter && !filter.has(key)) {
      continue;
    }
    const units = unitsByDrinkKey.get(key) ?? 0;
    if (units > 0) {
      filtered.push({key, units});
      total += units;
    }
  }
  if (total === 0) {
    return {slices: [], total: 0};
  }
  let cursor = -Math.PI / 2; // start at 12 o'clock
  const slices = filtered.map(({key, units}) => {
    const share = units / total;
    const startAngle = cursor;
    const endAngle = cursor + share * Math.PI * 2;
    cursor = endAngle;
    return {key, units, share, startAngle, endAngle};
  });
  return {slices, total};
}

function arcSectorPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
) {
  const path = Skia.Path.Make();
  const startDeg = (startAngle * 180) / Math.PI;
  const sweepDeg = ((endAngle - startAngle) * 180) / Math.PI;

  const outerRect = Skia.XYWHRect(
    cx - outerR,
    cy - outerR,
    outerR * 2,
    outerR * 2,
  );
  const innerRect = Skia.XYWHRect(
    cx - innerR,
    cy - innerR,
    innerR * 2,
    innerR * 2,
  );

  // Outer arc, start → end (clockwise).
  path.addArc(outerRect, startDeg, sweepDeg);
  // Line from outer-end to inner-end.
  path.lineTo(
    cx + innerR * Math.cos(endAngle),
    cy + innerR * Math.sin(endAngle),
  );
  // Inner arc, end → start (anticlockwise).
  path.addArc(innerRect, startDeg + sweepDeg, -sweepDeg);
  path.close();
  return path;
}

function hitTestSlice(
  slices: Slice[],
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  x: number,
  y: number,
): number {
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < innerR || dist > outerR + SELECTED_LIFT_PX) {
    return -1;
  }
  // Normalize angle to [-π/2, 3π/2) so it matches our slice start at 12 o'clock.
  let angle = Math.atan2(dy, dx);
  if (angle < -Math.PI / 2) {
    angle += Math.PI * 2;
  }
  for (let i = 0; i < slices.length; i++) {
    if (angle >= slices[i].startAngle && angle < slices[i].endAngle) {
      return i;
    }
  }
  return -1;
}

function DrinkTypeDonut({
  unitsByDrinkKey,
  drinkTypeFilter,
  size = DEFAULT_SIZE,
}: DrinkTypeDonutProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

  const {slices, total} = useMemo(
    () => buildSlices(unitsByDrinkKey, drinkTypeFilter),
    [unitsByDrinkKey, drinkTypeFilter],
  );

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - SELECTED_LIFT_PX;
  const innerR = outerR * INNER_RADIUS_RATIO;

  const isEmpty = slices.length === 0;
  const selected = selectedIdx >= 0 ? slices[selectedIdx] : undefined;

  const handlePress = (
    event?: GestureResponderEvent | KeyboardEvent,
  ): void => {
    if (isEmpty || !event || !('nativeEvent' in event)) {
      return;
    }
    const {locationX, locationY} = event.nativeEvent;
    const idx = hitTestSlice(
      slices,
      cx,
      cy,
      innerR,
      outerR,
      locationX,
      locationY,
    );
    setSelectedIdx(prev => (prev === idx ? -1 : idx));
  };

  const a11yLabel = translate('statistics.tabs.breakdown.donut.a11y');

  return (
    <View style={styles.alignItemsCenter}>
      <PressableWithoutFeedback
        accessible
        accessibilityLabel={a11yLabel}
        accessibilityRole="image"
        onPress={handlePress}
        style={{width: size, height: size}}>
        <Canvas style={{width: size, height: size}}>
          {isEmpty ? (
            <Path
              path={arcSectorPath(
                cx,
                cy,
                outerR,
                innerR,
                -Math.PI / 2,
                Math.PI * 1.5,
              )}
              color={theme.borderLighter}
              style="fill"
            />
          ) : (
            slices.map((slice, i) => {
              const lift = i === selectedIdx ? SELECTED_LIFT_PX : 0;
              return (
                <Path
                  key={slice.key}
                  path={arcSectorPath(
                    cx,
                    cy,
                    outerR + lift,
                    innerR,
                    slice.startAngle,
                    slice.endAngle,
                  )}
                  color={DRINK_KEY_COLORS[slice.key]}
                  style="fill"
                />
              );
            })
          )}
        </Canvas>
        <View
          pointerEvents="none"
          style={[
            styles.alignItemsCenter,
            styles.justifyContentCenter,
            {
              position: 'absolute',
              left: 0,
              top: 0,
              width: size,
              height: size,
            },
          ]}>
          {isEmpty ? (
            <Text
              style={[
                styles.textSupporting,
                styles.textAlignCenter,
                {paddingHorizontal: 16},
              ]}>
              {translate('statistics.tabs.breakdown.donut.empty')}
            </Text>
          ) : (
            <>
              <Text style={[styles.textHeadline]}>
                {translate('statistics.tabs.breakdown.donut.centerUnits', {
                  count: Math.round(total * 10) / 10,
                })}
              </Text>
              <Text style={[styles.textMicroSupporting]}>
                {translate('statistics.tabs.breakdown.donut.centerCaption')}
              </Text>
            </>
          )}
        </View>
      </PressableWithoutFeedback>
      {selected ? (
        <View
          style={[
            styles.flexRow,
            styles.alignItemsCenter,
            styles.mt2,
            {columnGap: 8},
          ]}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: DRINK_KEY_COLORS[selected.key],
            }}
          />
          <Text style={[styles.textLabelSupporting]}>
            {translate('statistics.tabs.breakdown.donut.sliceCaption', {
              label: translate(DRINK_LABEL_KEY[selected.key]),
              units: Math.round(selected.units * 10) / 10,
              share: Math.round(selected.share * 100),
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

DrinkTypeDonut.displayName = 'DrinkTypeDonut';

export default DrinkTypeDonut;
export type {DrinkTypeDonutProps};
