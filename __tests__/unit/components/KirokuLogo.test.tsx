import {render} from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import React from 'react';
import KirokuLogoSvg from '@components/KirokuLogo/KirokuLogoSvg';
import {LOGO_SHAPES} from '@components/KirokuLogo/logoShapes';
import CONST from '@src/CONST';

const MASTER_SVG_PATH = path.resolve(
  __dirname,
  '../../../assets/images/app-logo.svg',
);

/**
 * The (d, fill) pairs of the master art, parsed straight from the committed
 * SVG. logoShapes.ts mirrors this list so the in-app logo and the generated
 * splash assets can never drift apart — the iOS splash → logo handoff
 * cross-dissolves one onto the other, where any geometry drift shows as a
 * visible blink.
 */
function parseMasterShapes(): Array<{d: string; fill: string}> {
  const svg = fs.readFileSync(MASTER_SVG_PATH, 'utf8');
  return Array.from(
    svg.matchAll(/<path d="([^"]+)" fill="([^"]+)"/g),
    match => ({d: match[1], fill: match[2]}),
  );
}

type RenderedNode = {
  props?: Record<string, unknown>;
  children?: Array<RenderedNode | string> | null;
};

/** Collects every value of the given prop in the rendered JSON tree */
function collectProp(node: RenderedNode | null, prop: string): unknown[] {
  if (!node) {
    return [];
  }
  const own = node.props && prop in node.props ? [node.props[prop]] : [];
  const fromChildren = (node.children ?? []).flatMap(child =>
    typeof child === 'string' ? [] : collectProp(child, prop),
  );
  return [...own, ...fromChildren];
}

describe('logoShapes', () => {
  it('mirrors the master art exactly (paths and fills)', () => {
    const master = parseMasterShapes();
    // Sanity: the master itself parsed into a plausible mascot shape list.
    expect(master.length).toBeGreaterThanOrEqual(10);
    expect(LOGO_SHAPES).toEqual(master);
  });

  it('uses only literal hex fills (no theme tokens, no strokes)', () => {
    LOGO_SHAPES.forEach(shape => {
      expect(shape.fill).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });
});

describe('KirokuLogoSvg', () => {
  it('renders every mascot shape with its own fill on production (no badge)', () => {
    const {toJSON} = render(
      <KirokuLogoSvg environment={CONST.ENVIRONMENT.PROD} />,
    );
    const tree = toJSON() as RenderedNode;
    expect(collectProp(tree, 'd')).toEqual(LOGO_SHAPES.map(shape => shape.d));
    // SVG text renders its string into the tspan `content` prop, so badge
    // presence is asserted on props rather than via text queries.
    expect(collectProp(tree, 'content')).not.toContain('DEV');
  });

  it('renders the environment badge on development', () => {
    const {toJSON} = render(
      <KirokuLogoSvg environment={CONST.ENVIRONMENT.DEV} />,
    );
    expect(collectProp(toJSON() as RenderedNode, 'content')).toContain('DEV');
  });
});
