import React from 'react';
import {Polygon, Text as SvgText} from 'react-native-svg';
import type Environment from '@libs/Environment/getEnvironment/types';
import {
  BADGES,
  BADGE_FONT_SIZE,
  BADGE_TEXT_X,
  BADGE_TEXT_Y,
  BADGE_TX,
  BADGE_TY,
  LOGO_CANVAS,
} from './logoShapes';

type LogoBadgeProps = {
  /** Current app environment; the badge renders only for non-production builds */
  environment: Environment;
};

function LogoBadge({environment}: LogoBadgeProps) {
  const badge = BADGES[environment];
  if (!badge) {
    return null;
  }
  return (
    <>
      <Polygon
        points={`${BADGE_TX},${LOGO_CANVAS} ${LOGO_CANVAS},${LOGO_CANVAS} ${LOGO_CANVAS},${BADGE_TY}`}
        fill={badge.color}
      />
      <SvgText
        x={BADGE_TEXT_X}
        y={BADGE_TEXT_Y}
        fontSize={BADGE_FONT_SIZE}
        fill="white"
        fontFamily="Arial,Helvetica,sans-serif"
        fontWeight="bold"
        textAnchor="middle">
        {badge.label}
      </SvgText>
    </>
  );
}

LogoBadge.displayName = 'LogoBadge';

export default LogoBadge;
