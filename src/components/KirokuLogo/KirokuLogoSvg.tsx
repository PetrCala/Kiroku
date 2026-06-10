import React from 'react';
import Svg, {Path} from 'react-native-svg';
import type Environment from '@libs/Environment/getEnvironment/types';
import LogoBadge from './LogoBadge';
import {LOGO_CANVAS, LOGO_SHAPES} from './logoShapes';

type KirokuLogoSvgProps = {
  fill: string;
  environment: Environment;
};

function KirokuLogoSvg({fill, environment}: KirokuLogoSvgProps) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${LOGO_CANVAS} ${LOGO_CANVAS}`}>
      {LOGO_SHAPES.map(d => (
        <Path key={d} d={d} fill={fill} />
      ))}
      <LogoBadge environment={environment} />
    </Svg>
  );
}

KirokuLogoSvg.displayName = 'KirokuLogoSvg';

export default KirokuLogoSvg;
