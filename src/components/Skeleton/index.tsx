import React from 'react';
import {View} from 'react-native';
import {Rect} from 'react-native-svg';
import SkeletonViewContentLoader from '@components/SkeletonViewContentLoader';
import useTheme from '@hooks/useTheme';
import variables from '@styles/variables';
import type SkeletonProps from './types';

/**
 * A single shimmering placeholder block — the reusable skeleton primitive.
 *
 * Drop it in anywhere a `<View>` placeholder would go: it sizes itself from
 * `width`/`height`, rounds with `radius` (or `circle`), and animates a gradient
 * sweep using the shared `skeletonBase` → `skeletonHighlight` theme tokens.
 * Animation is delegated to `SkeletonViewContentLoader` (the app's
 * `react-content-loader` wrapper), which handles the web/native split.
 *
 * Each block is its own content loader, so compose freely with flexbox. For
 * dense grids (calendars, heatmaps) pass `animate={false}` to avoid mounting
 * many simultaneous SVG animations.
 */
function Skeleton({
  width = '100%',
  height,
  radius = variables.componentBorderRadiusMedium,
  circle = false,
  animate = true,
  style,
  accessibilityLabel,
}: SkeletonProps) {
  const theme = useTheme();
  const resolvedRadius = circle ? height / 2 : radius;
  const resolvedWidth = circle ? height : width;
  const a11yProps = accessibilityLabel
    ? ({
        accessible: true,
        accessibilityRole: 'progressbar' as const,
        accessibilityLabel,
      } as const)
    : null;

  return (
    <View
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...a11yProps}
      style={[{width: resolvedWidth, height}, style]}>
      <SkeletonViewContentLoader
        animate={animate}
        height={height}
        backgroundColor={theme.skeletonBase}
        foregroundColor={theme.skeletonHighlight}>
        <Rect
          x="0"
          y="0"
          rx={resolvedRadius}
          ry={resolvedRadius}
          width="100%"
          height="100%"
        />
      </SkeletonViewContentLoader>
    </View>
  );
}

Skeleton.displayName = 'Skeleton';

export default Skeleton;
export type {SkeletonProps};
