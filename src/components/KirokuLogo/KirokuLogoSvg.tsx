import React from 'react';
import Svg, {Path} from 'react-native-svg';
import type Environment from '@libs/Environment/getEnvironment/types';
import LogoBadge from './LogoBadge';
import {LOGO_CANVAS, LOGO_SHAPES} from './logoShapes';

type KirokuLogoSvgProps = {
  environment: Environment;
};

// The mascot is full-color flat art — every shape carries its own fill, so
// there is no theme tinting (the same art renders on light and dark surfaces,
// matching the native splash assets pixel for pixel).
function KirokuLogoSvg({environment}: KirokuLogoSvgProps) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${LOGO_CANVAS} ${LOGO_CANVAS}`}>
      {LOGO_SHAPES.map(shape => (
        <Path key={shape.d} d={shape.d} fill={shape.fill} />
      ))}
      <LogoBadge environment={environment} />
    </Svg>
  );
}

KirokuLogoSvg.displayName = 'KirokuLogoSvg';

export default KirokuLogoSvg;
