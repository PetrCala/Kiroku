import type {StyleProp, ViewStyle} from 'react-native';

type SkeletonProps = {
  /** Block width — dp number or percentage string. Defaults to filling the parent. */
  width?: number | `${number}%`;

  /** Block height in dp. A skeleton block always has an intrinsic height. */
  height: number;

  /** Corner radius in dp. */
  radius?: number;

  /** Render as a circle: radius becomes height/2 and width is forced to height. */
  circle?: boolean;

  /** Whether to run the shimmer sweep. Disable for dense grids to avoid mounting many SVG animations at once. */
  animate?: boolean;

  /** Outer container style — margins, flex, absolute positioning. */
  style?: StyleProp<ViewStyle>;

  /**
   * When set, the block is announced to screen readers as a loading
   * progressbar. Leave undefined for decorative blocks so a multi-block
   * skeleton announces once (from its container), not once per block.
   */
  accessibilityLabel?: string;
};

export default SkeletonProps;
