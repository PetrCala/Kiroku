/**
 * Builds the three committed mascot masters from parametric geometry:
 *
 *   assets/images/app-logo.svg            full cut (slim pencil, +14° writing tilt)
 *   assets/images/app-icon.svg            icon cut (upright stubby pencil)
 *   assets/images/app-logo-silhouette.svg icon cut, white, face as evenodd holes
 *
 * Every shape is baked to fill-only <path> data (M/L/C/Z, plus one A-free
 * elliptical mouth approximated with cubics) so the masters satisfy the
 * generate-icons.mjs constraints: no strokes, no circle/ellipse/group
 * elements, literal hex fills, and rotation pre-applied to coordinates.
 *
 * Run from the repo root: node assets/design/mascot/build-masters.mjs
 * The character design exploration lives in ./exploration (generate.cjs).
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const OUT_DIR = path.join(REPO_ROOT, 'assets/images');

const C = {
  yellow: '#F5C400',
  yellowDark: '#D9AD00',
  wood: '#E8C9A0',
  graphite: '#3A3A3A',
  ink: '#1A1A1A',
  white: '#FFFFFF',
  foamEdge: '#D9D2C0',
};

const KAPPA = 0.5522847498;

// ---- geometry → baked path data ---------------------------------------------

const fmt = n => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};

/** Returns a point transformer applying rotation by deg around (cx, cy). */
function rotation(deg, cx, cy) {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return ([x, y]) => [
    cx + (x - cx) * cos - (y - cy) * sin,
    cy + (x - cx) * sin + (y - cy) * cos,
  ];
}

const IDENTITY = p => p;

class PathBuilder {
  constructor(T) {
    this.T = T;
    this.parts = [];
  }

  M(p) {
    const [x, y] = this.T(p);
    this.parts.push(`M${fmt(x)} ${fmt(y)}`);
    return this;
  }

  L(p) {
    const [x, y] = this.T(p);
    this.parts.push(`L${fmt(x)} ${fmt(y)}`);
    return this;
  }

  C(c1, c2, p) {
    const [x1, y1] = this.T(c1);
    const [x2, y2] = this.T(c2);
    const [x, y] = this.T(p);
    this.parts.push(
      `C${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)} ${fmt(x)} ${fmt(y)}`,
    );
    return this;
  }

  Z() {
    this.parts.push('Z');
    return this;
  }

  toString() {
    return this.parts.join(' ');
  }
}

/** Circle as four cubic arcs (clockwise). */
function circleD(cx, cy, r, T) {
  const k = KAPPA * r;
  return new PathBuilder(T)
    .M([cx + r, cy])
    .C([cx + r, cy + k], [cx + k, cy + r], [cx, cy + r])
    .C([cx - k, cy + r], [cx - r, cy + k], [cx - r, cy])
    .C([cx - r, cy - k], [cx - k, cy - r], [cx, cy - r])
    .C([cx + k, cy - r], [cx + r, cy - k], [cx + r, cy])
    .Z()
    .toString();
}

function polygonD(pts, T) {
  const b = new PathBuilder(T).M(pts[0]);
  for (const p of pts.slice(1)) {
    b.L(p);
  }
  return b.Z().toString();
}

function rectD(x, y, w, h, T) {
  return polygonD(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    T,
  );
}

/** Rounded rectangle (uniform radius, clamped) as lines + cubic corners. */
function roundedRectD(x, y, w, h, radius, T) {
  const r = Math.min(radius, w / 2, h / 2);
  const k = KAPPA * r;
  return new PathBuilder(T)
    .M([x + r, y])
    .L([x + w - r, y])
    .C([x + w - r + k, y], [x + w, y + r - k], [x + w, y + r])
    .L([x + w, y + h - r])
    .C([x + w, y + h - r + k], [x + w - r + k, y + h], [x + w - r, y + h])
    .L([x + r, y + h])
    .C([x + r - k, y + h], [x, y + h - r + k], [x, y + h - r])
    .L([x, y + r])
    .C([x, y + r - k], [x + r - k, y], [x + r, y])
    .Z()
    .toString();
}

/**
 * A stroked quadratic Bézier (round caps) baked to a filled outline.
 * Sampled as a polygon — invisible at render sizes, trivially rotatable.
 */
function quadStrokeD(p0, c, p1, halfW, T) {
  const N = 14;
  const CAP = 7;
  const at = t => {
    const mt = 1 - t;
    return [
      mt * mt * p0[0] + 2 * mt * t * c[0] + t * t * p1[0],
      mt * mt * p0[1] + 2 * mt * t * c[1] + t * t * p1[1],
    ];
  };
  const tangent = t => {
    const dx = 2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]);
    const dy = 2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]);
    const len = Math.hypot(dx, dy);
    return [dx / len, dy / len];
  };
  const upper = [];
  const lower = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [x, y] = at(t);
    const [tx, ty] = tangent(t);
    const [nx, ny] = [-ty, tx];
    upper.push([x + nx * halfW, y + ny * halfW]);
    lower.push([x - nx * halfW, y - ny * halfW]);
  }
  const cap = (center, normal, tangentDir) => {
    const pts = [];
    for (let i = 1; i < CAP; i++) {
      const th = (Math.PI * i) / CAP;
      pts.push([
        center[0] +
          halfW * (normal[0] * Math.cos(th) + tangentDir[0] * Math.sin(th)),
        center[1] +
          halfW * (normal[1] * Math.cos(th) + tangentDir[1] * Math.sin(th)),
      ]);
    }
    return pts;
  };
  const [tx1, ty1] = tangent(1);
  const [tx0, ty0] = tangent(0);
  const endCap = cap(at(1), [-ty1, tx1], [tx1, ty1]);
  const startCap = cap(at(0), [ty0, -tx0], [-tx0, -ty0]);
  return polygonD([...upper, ...endCap, ...lower.reverse(), ...startCap], T);
}

/** Open laughing mouth: flat top, elliptical bottom (two cubic arcs). */
function grinD(cx, y, rx, ry, T) {
  const kx = KAPPA * rx;
  const ky = KAPPA * ry;
  return new PathBuilder(T)
    .M([cx - rx, y])
    .C([cx - rx, y + ky], [cx - kx, y + ry], [cx, y + ry])
    .C([cx + kx, y + ry], [cx + rx, y + ky], [cx + rx, y])
    .Z()
    .toString();
}

// ---- shared mascot pieces ----------------------------------------------------

function pencilShapes(
  {halfW, bodyTop, woodY, tipY, graphiteY, facetDx, facetTop},
  T,
) {
  const cx = 512;
  const graphiteHw = (halfW * (tipY - graphiteY)) / (tipY - woodY);
  return {
    body: {
      d: rectD(cx - halfW, bodyTop, halfW * 2, woodY - bodyTop, T),
      fill: C.yellow,
    },
    facets: [-1, 1].map(s => ({
      d: rectD(cx + s * facetDx - 5, facetTop, 10, woodY - facetTop, T),
      fill: C.yellowDark,
    })),
    wood: {
      d: polygonD(
        [
          [cx - halfW, woodY],
          [cx + halfW, woodY],
          [cx, tipY],
        ],
        T,
      ),
      fill: C.wood,
    },
    graphite: {
      d: polygonD(
        [
          [cx - graphiteHw, graphiteY],
          [cx + graphiteHw, graphiteY],
          [cx, tipY],
        ],
        T,
      ),
      fill: C.graphite,
    },
  };
}

function foamShapes(
  {rectHalfW, top, baseY, lobes, drip},
  {expand = 0, fill},
  T,
) {
  const cx = 512;
  const e = expand;
  const shapes = [
    {
      d: roundedRectD(
        cx - rectHalfW - e,
        top - e,
        (rectHalfW + e) * 2,
        baseY - top + 2 * e,
        34 + e,
        T,
      ),
      fill,
    },
    ...lobes.map(([dx, cy, r]) => ({d: circleD(cx + dx, cy, r + e, T), fill})),
  ];
  if (drip) {
    const [dx, y0, y1, w] = drip;
    shapes.push({
      d: roundedRectD(
        cx + dx - w / 2 - e,
        y0 - e,
        w + 2 * e,
        y1 - y0 + 2 * e,
        (w + 2 * e) / 2,
        T,
      ),
      fill,
    });
  }
  return shapes;
}

// ---- masters -----------------------------------------------------------------

/** Full cut: variant 11 — slim pencil, +14° writing tilt, soft foam contour. */
function buildFullCut() {
  const T = rotation(14, 512, 540);
  const dims = {
    halfW: 150,
    bodyTop: 320,
    woodY: 700,
    tipY: 880,
    graphiteY: 812,
    facetDx: 100,
    facetTop: 353,
  };
  const foam = {
    rectHalfW: 158,
    top: 268,
    baseY: 345,
    lobes: [
      [-95, 262, 66],
      [0, 238, 80],
      [95, 264, 62],
    ],
  };
  const pencil = pencilShapes(dims, T);
  const faceDx = 8;
  const eyeY = 450;
  const eyeR = 23;
  const eyes = [-58, 58].map(dx => ({
    d: circleD(512 + faceDx + dx, eyeY, eyeR, T),
    fill: C.ink,
  }));
  const shines = [-58, 58].map(dx => ({
    d: circleD(512 + faceDx + dx - eyeR * 0.32, eyeY - eyeR * 0.35, 9, T),
    fill: C.white,
  }));
  const smile = {
    d: quadStrokeD(
      [512 + faceDx - 30, 515],
      [512 + faceDx, 531],
      [512 + faceDx + 30, 515],
      7.5,
      T,
    ),
    fill: C.ink,
  };
  return [
    pencil.body,
    ...pencil.facets,
    pencil.wood,
    pencil.graphite,
    ...foamShapes(foam, {expand: 7, fill: C.foamEdge}, T),
    ...foamShapes(foam, {fill: C.white}, T),
    ...eyes,
    ...shines,
    smile,
  ];
}

const ICON_DIMS = {
  halfW: 255,
  bodyTop: 330,
  woodY: 615,
  tipY: 795,
  graphiteY: 728,
  facetDx: 150,
  facetTop: 353,
};
const ICON_FOAM = {
  rectHalfW: 295,
  top: 225,
  baseY: 345,
  lobes: [
    [-185, 233, 105],
    [0, 194, 135],
    [180, 236, 100],
  ],
  drip: [185, 330, 470, 56],
};
const ICON_FACE = {
  eyeDx: 95,
  eyeY: 448,
  eyeR: 38,
  shineR: 11,
  grinY: 538,
  grinRx: 66,
  grinRy: 38,
};

/** Icon cut: upright stubby pencil, full color, no strokes anywhere. */
function buildIconCut() {
  const T = IDENTITY;
  const pencil = pencilShapes(ICON_DIMS, T);
  const f = ICON_FACE;
  const eyes = [-f.eyeDx, f.eyeDx].map(dx => ({
    d: circleD(512 + dx, f.eyeY, f.eyeR, T),
    fill: C.ink,
  }));
  const shines = [-f.eyeDx, f.eyeDx].map(dx => ({
    d: circleD(512 + dx - f.eyeR * 0.32, f.eyeY - f.eyeR * 0.35, f.shineR, T),
    fill: C.white,
  }));
  const grin = {d: grinD(512, f.grinY, f.grinRx, f.grinRy, T), fill: C.ink};
  return [
    pencil.body,
    ...pencil.facets,
    pencil.wood,
    pencil.graphite,
    ...foamShapes(ICON_FOAM, {fill: C.white}, T),
    ...eyes,
    ...shines,
    grin,
  ];
}

/** Silhouette: icon-cut geometry, single white fill, face as evenodd holes. */
function buildSilhouette() {
  const T = IDENTITY;
  const {halfW, bodyTop, woodY, tipY} = ICON_DIMS;
  // Larger face holes than the color icon cut: this master is consumed at
  // notification size (24dp) where the icon-cut features would close up.
  const f = {...ICON_FACE, eyeR: 46, grinRx: 76, grinRy: 44};
  const bodyWithFaceHoles = {
    d: [
      rectD(512 - halfW, bodyTop, halfW * 2, woodY - bodyTop, T),
      circleD(512 - f.eyeDx, f.eyeY, f.eyeR, T),
      circleD(512 + f.eyeDx, f.eyeY, f.eyeR, T),
      grinD(512, f.grinY, f.grinRx, f.grinRy, T),
    ].join(' '),
    fill: C.white,
    fillRule: 'evenodd',
  };
  const cone = {
    d: polygonD(
      [
        [512 - halfW, woodY],
        [512 + halfW, woodY],
        [512, tipY],
      ],
      T,
    ),
    fill: C.white,
  };
  return [
    bodyWithFaceHoles,
    cone,
    ...foamShapes(ICON_FOAM, {fill: C.white}, T),
  ];
}

// ---- emit --------------------------------------------------------------------

function toSvg(shapes) {
  const paths = shapes
    .map(s => {
      const rule = s.fillRule ? ` fill-rule="${s.fillRule}"` : '';
      return `  <path d="${s.d}" fill="${s.fill}"${rule}/>`;
    })
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">\n${paths}\n</svg>\n`;
}

const MASTERS = [
  ['app-logo.svg', buildFullCut()],
  ['app-icon.svg', buildIconCut()],
  ['app-logo-silhouette.svg', buildSilhouette()],
];

for (const [file, shapes] of MASTERS) {
  fs.writeFileSync(path.join(OUT_DIR, file), toSvg(shapes));
  console.log(`wrote assets/images/${file} (${shapes.length} paths)`);
}
