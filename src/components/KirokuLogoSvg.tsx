import React from 'react';
import Svg, {Path, Polygon, Rect, Text as SvgText} from 'react-native-svg';
import type {ValueOf} from 'type-fest';
import CONST from '@src/CONST';

type Environment = ValueOf<typeof CONST.ENVIRONMENT>;

type Badge = {
  label: string;
  color: string;
};

// Mirror of the badge map in scripts/generate-icons.mjs — keep in sync so the
// in-app logo matches the rasterized icon assets generated for native targets.
const BADGES: Partial<Record<Environment, Badge>> = {
  [CONST.ENVIRONMENT.DEV]: {label: 'DEV', color: '#007AFF'},
  [CONST.ENVIRONMENT.STAGING]: {label: 'STG', color: '#FF9500'},
  [CONST.ENVIRONMENT.ADHOC]: {label: 'ADHOC', color: '#AF52DE'},
};

const CANVAS = 1024;
// Badge geometry mirrors scripts/generate-icons.mjs:variantSvg.
const BADGE_TRI = Math.round(CANVAS * 0.38);
const BADGE_TX = CANVAS - BADGE_TRI;
const BADGE_TY = CANVAS - BADGE_TRI;
const BADGE_FONT_SIZE = Math.round(BADGE_TRI * 0.28);
const BADGE_TEXT_X = CANVAS - BADGE_TRI * 0.38;
const BADGE_TEXT_Y = CANVAS - BADGE_TRI * 0.18;

type KirokuLogoSvgProps = {
  fill: string;
  environment: Environment;
};

function KirokuLogoSvg({fill, environment}: KirokuLogoSvgProps) {
  const badge = BADGES[environment];
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${CANVAS} ${CANVAS}`}>
      <Path d="M129 808L316 480L374 580L243.117 808H129Z" fill={fill} />
      <Path d="M895.5 808L708.5 480L650.5 580L781.383 808H895.5Z" fill={fill} />
      <Rect
        x={523}
        y={618}
        width={185}
        height={20}
        transform="rotate(90 523 618)"
        fill={fill}
      />
      <Rect
        x={602}
        y={808}
        width={180}
        height={9.99998}
        transform="rotate(-180 602 808)"
        fill={fill}
      />
      <Path d="M636.5 348L512.66 134L389 348H636.5Z" fill={fill} />
      <Path d="M388.5 434L512.34 648L636 434L388.5 434Z" fill={fill} />
      {badge ? (
        <>
          <Polygon
            points={`${BADGE_TX},${CANVAS} ${CANVAS},${CANVAS} ${CANVAS},${BADGE_TY}`}
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
      ) : null}
    </Svg>
  );
}

KirokuLogoSvg.displayName = 'KirokuLogoSvg';

export default KirokuLogoSvg;
