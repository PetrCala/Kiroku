// Kiroku mascot concept generator — pencil character with beer-foam top.
// Writes one SVG per variant into /tmp/kiroku-mascot/.
const fs = require("fs");
const path = require("path");
const OUT = "/tmp/kiroku-mascot";
fs.mkdirSync(OUT, { recursive: true });

const C = {
  yellow: "#F5C400",
  yellowDark: "#D9AD00", // facet line
  yellowPanel: "#E9B800", // side shading panel experiment
  wood: "#E8C9A0",
  graphite: "#3A3A3A",
  ink: "#1A1A1A",
  white: "#FFFFFF",
  cream: "#F4EEDD", // off-white foam for outline-free variants (visible on white bg)
  foamEdge: "#D9D2C0", // soft contour for white foam in outline-free variants
  blush: "#F49E7E",
};

function attrs(a) {
  return Object.entries(a)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
}
const circle = (cx, cy, r) => ({ tag: "circle", a: { cx, cy, r } });
const ellipse = (cx, cy, rx, ry) => ({ tag: "ellipse", a: { cx, cy, rx, ry } });
const rect = (x, y, w, h, rx) => ({
  tag: "rect",
  a: { x, y, width: w, height: h, ...(rx ? { rx } : {}) },
});
const poly = (pts) => ({
  tag: "polygon",
  a: { points: pts.map((p) => p.join(",")).join(" ") },
});
const pathd = (d) => ({ tag: "path", a: { d } });

function emit(s, extra = {}) {
  return `<${s.tag} ${attrs({ ...s.a, ...extra })}/>`;
}

const CX = 512;

// ---- builders --------------------------------------------------------------

function buildBody(v, bodySil, det) {
  const { halfW, bodyTop, woodY, tipY, graphiteY } = v;
  if (v.tip) {
    bodySil.push({
      s: rect(CX - halfW, bodyTop, halfW * 2, woodY - bodyTop),
      fill: C.yellow,
    });
    bodySil.push({
      s: poly([
        [CX - halfW, woodY],
        [CX + halfW, woodY],
        [CX, tipY],
      ]),
      fill: C.wood,
    });
    const hw = (halfW * (tipY - graphiteY)) / (tipY - woodY);
    bodySil.push({
      s: poly([
        [CX - hw, graphiteY],
        [CX + hw, graphiteY],
        [CX, tipY],
      ]),
      fill: C.graphite,
    });
  } else {
    const b = v.bottomY;
    const q = 56;
    bodySil.push({
      s: pathd(
        `M ${CX - halfW} ${bodyTop} H ${CX + halfW} V ${b - q} Q ${CX + halfW} ${b} ${CX + halfW - q} ${b} H ${CX - halfW + q} Q ${CX - halfW} ${b} ${CX - halfW} ${b - q} Z`,
      ),
      fill: C.yellow,
    });
  }
  const detailBottom = v.tip ? woodY : v.bottomY - 60;
  if (v.facetDx) {
    const y0 = v.foam.baseY + 8;
    const y1 = detailBottom - (v.scallops ? 26 : 0);
    for (const s of [-1, 1]) {
      det.push({
        s: rect(CX + s * v.facetDx - 5, y0, 10, y1 - y0),
        fill: C.yellowDark,
      });
    }
  }
  if (v.sidePanel) {
    det.push({
      s: rect(
        CX + halfW - 44,
        v.foam.baseY + 6,
        44,
        detailBottom - (v.foam.baseY + 6),
      ),
      fill: C.yellowPanel,
    });
  }
  if (v.scallops) {
    for (const [dx, r] of v.scallops)
      det.push({ s: circle(CX + dx, v.woodY, r), fill: C.yellow });
  }
}

function buildFoam(v, foamSil) {
  const f = v.foam;
  const col = v.foamColor;
  foamSil.push({
    s: rect(CX - f.halfW, f.top, f.halfW * 2, f.baseY - f.top, 34),
    fill: col,
  });
  for (const [dx, cy, r] of f.lobes)
    foamSil.push({ s: circle(CX + dx, cy, r), fill: col });
  if (f.drip) {
    const [dx, y0, y1, w] = f.drip;
    foamSil.push({
      s: rect(CX + dx - w / 2, y0, w, y1 - y0, w / 2),
      fill: col,
    });
  }
  for (const [dx, cy, r] of f.bubbles ?? [])
    foamSil.push({ s: circle(CX + dx, cy, r), fill: col });
}

function buildFace(v, det) {
  const fc = v.face;
  const ox = fc.faceDx ?? 0;
  const sw = fc.sw;
  const stroke = {
    fill: "none",
    stroke: C.ink,
    "stroke-width": sw,
    "stroke-linecap": "round",
  };

  const dotEye = (ex) => {
    det.push({ s: circle(ex, fc.eyeY, fc.eyeR), fill: C.ink });
    if (fc.shine) {
      det.push({
        s: circle(
          ex - fc.eyeR * 0.32,
          fc.eyeY - fc.eyeR * 0.35,
          fc.shineR ?? Math.max(7, fc.eyeR * 0.27),
        ),
        fill: C.white,
      });
    }
  };
  const ovalEye = (ex) => {
    det.push({ s: ellipse(ex, fc.eyeY, fc.eyeRx, fc.eyeRy), fill: C.ink });
    if (fc.shine) {
      det.push({
        s: circle(
          ex - fc.eyeRx * 0.3,
          fc.eyeY - fc.eyeRy * 0.38,
          Math.max(7, fc.eyeRx * 0.3),
        ),
        fill: C.white,
      });
    }
  };
  const arcEye = (ex, w, d) => {
    det.push({
      s: pathd(
        `M ${ex - w} ${fc.eyeY + d * 0.3} Q ${ex} ${fc.eyeY - d} ${ex + w} ${fc.eyeY + d * 0.3}`,
      ),
      attrs: stroke,
    });
  };

  const exL = CX + ox - fc.eyeDx;
  const exR = CX + ox + fc.eyeDx;
  switch (fc.eyes) {
    case "dot":
      dotEye(exL);
      dotEye(exR);
      break;
    case "oval":
      ovalEye(exL);
      ovalEye(exR);
      break;
    case "happy":
      arcEye(exL, fc.arcW, fc.arcD);
      arcEye(exR, fc.arcW, fc.arcD);
      break;
    case "sleepy":
      arcEye(exL, fc.arcW, fc.arcD);
      arcEye(exR, fc.arcW, fc.arcD);
      break;
    case "wink":
      arcEye(exL, fc.arcW, fc.arcD);
      dotEye(exR);
      break;
  }

  if (fc.blush) {
    const b = fc.blush;
    for (const s of [-1, 1]) {
      det.push({
        s: ellipse(CX + ox + s * b.dx, fc.eyeY + b.dy, b.rx, b.ry),
        fill: C.blush,
      });
    }
  }

  const my = fc.mouthY;
  const mx = CX + ox;
  switch (fc.mouth) {
    case "smile":
      det.push({
        s: pathd(
          `M ${mx - fc.mw} ${my} Q ${mx} ${my + fc.md} ${mx + fc.mw} ${my}`,
        ),
        attrs: stroke,
      });
      break;
    case "small":
      det.push({
        s: pathd(
          `M ${mx - fc.mw} ${my} Q ${mx} ${my + fc.md} ${mx + fc.mw} ${my}`,
        ),
        attrs: stroke,
      });
      break;
    case "smirk":
      det.push({
        s: pathd(
          `M ${mx - fc.mw} ${my + 8} Q ${mx} ${my + fc.md} ${mx + fc.mw + 8} ${my - 8}`,
        ),
        attrs: stroke,
      });
      break;
    case "grin":
      det.push({
        s: pathd(
          `M ${mx - fc.grinR} ${my} A ${fc.grinR} ${fc.grinR * 0.58} 0 0 0 ${mx + fc.grinR} ${my} Z`,
        ),
        fill: C.ink,
      });
      break;
    case "none":
      break;
  }
}

function buildVariant(v) {
  const bodySil = [];
  const foamSil = [];
  const det = [];
  buildBody(v, bodySil, det);
  buildFoam(v, foamSil);
  const face = [];
  buildFace(v, face);

  const parts = [];
  const allSil = [...bodySil, ...foamSil];
  if (v.outline) {
    // union-outline trick: expanded black layer underneath all silhouette fills
    for (const it of allSil) {
      parts.push(
        emit(it.s, {
          fill: C.ink,
          stroke: C.ink,
          "stroke-width": v.outline * 2,
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
        }),
      );
    }
  }
  for (const it of bodySil) parts.push(emit(it.s, { fill: it.fill }));
  for (const it of det) parts.push(emit(it.s, it.attrs ?? { fill: it.fill }));
  if (v.foamContour && !v.outline) {
    for (const it of foamSil) {
      parts.push(
        emit(it.s, {
          fill: C.foamEdge,
          stroke: C.foamEdge,
          "stroke-width": 14,
          "stroke-linejoin": "round",
        }),
      );
    }
  }
  for (const it of foamSil) parts.push(emit(it.s, { fill: it.fill }));
  for (const it of face) parts.push(emit(it.s, it.attrs ?? { fill: it.fill }));

  const inner = parts.join("\n  ");
  const g = v.tilt
    ? `<g transform="rotate(${v.tilt} 512 540)">\n  ${inner}\n  </g>`
    : inner;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">\n  ${g}\n</svg>\n`;
}

// ---- shared dimension presets ----------------------------------------------

const slim = {
  halfW: 150,
  bodyTop: 320,
  woodY: 700,
  tipY: 880,
  graphiteY: 812,
  tip: true,
};
const chubby = {
  halfW: 230,
  bodyTop: 300,
  woodY: 645,
  tipY: 845,
  graphiteY: 770,
  tip: true,
};
const stubby = {
  halfW: 255,
  bodyTop: 330,
  woodY: 615,
  tipY: 795,
  graphiteY: 728,
  tip: true,
};

const slimCap = {
  halfW: 158,
  top: 268,
  baseY: 345,
  lobes: [
    [-95, 262, 66],
    [0, 238, 80],
    [95, 264, 62],
  ],
};
const slimCapBouncy = {
  halfW: 158,
  top: 262,
  baseY: 345,
  lobes: [
    [-100, 254, 70],
    [0, 228, 84],
    [98, 258, 64],
  ],
};
const chubbyCap = {
  halfW: 238,
  top: 252,
  baseY: 342,
  lobes: [
    [-150, 248, 80],
    [0, 224, 95],
    [148, 250, 76],
  ],
};
const chubbyOver = {
  halfW: 266,
  top: 238,
  baseY: 332,
  lobes: [
    [-172, 230, 98],
    [-6, 196, 124],
    [164, 236, 94],
  ],
};
const stubbyOver = {
  halfW: 295,
  top: 225,
  baseY: 345,
  lobes: [
    [-185, 233, 105],
    [0, 194, 135],
    [180, 236, 100],
  ],
};
const badgeFoam = {
  halfW: 300,
  top: 230,
  baseY: 352,
  lobes: [
    [-190, 238, 105],
    [0, 202, 135],
    [185, 242, 100],
  ],
};

// ---- variants ----------------------------------------------------------------

const VARIANTS = [
  {
    slug: "01-slim-classic-smile",
    ...slim,
    facetDx: 100,
    foam: slimCap,
    foamColor: C.white,
    foamContour: true,
    face: {
      eyes: "dot",
      eyeR: 24,
      eyeDx: 60,
      eyeY: 445,
      shine: true,
      mouth: "smile",
      mw: 46,
      md: 34,
      mouthY: 515,
      sw: 16,
    },
  },
  {
    slug: "02-slim-outlined-grin",
    ...slim,
    outline: 12,
    foam: slimCapBouncy,
    foamColor: C.white,
    face: {
      eyes: "dot",
      eyeR: 25,
      eyeDx: 62,
      eyeY: 442,
      shine: true,
      mouth: "grin",
      grinR: 62,
      mouthY: 500,
      sw: 16,
    },
  },
  {
    slug: "03-chubby-blush-drip",
    ...chubby,
    facetDx: 128,
    scallops: [
      [-150, 28],
      [-15, 32],
      [125, 28],
    ],
    foam: { ...chubbyOver, drip: [170, 316, 462, 54] },
    foamColor: C.white,
    foamContour: true,
    face: {
      eyes: "dot",
      eyeR: 32,
      eyeDx: 84,
      eyeY: 432,
      shine: true,
      blush: { dx: 148, dy: 44, rx: 34, ry: 20 },
      mouth: "smile",
      mw: 60,
      md: 40,
      mouthY: 522,
      sw: 18,
    },
  },
  {
    slug: "04-chubby-outlined-tilt",
    ...chubby,
    outline: 12,
    tilt: 9,
    foam: { ...chubbyOver, bubbles: [[252, 108, 28]] },
    foamColor: C.white,
    face: {
      eyes: "dot",
      eyeR: 33,
      eyeDx: 86,
      eyeY: 430,
      shine: true,
      mouth: "grin",
      grinR: 70,
      mouthY: 508,
      sw: 18,
    },
  },
  {
    slug: "05-chubby-zen",
    ...chubby,
    facetDx: 130,
    foam: chubbyCap,
    foamColor: C.white,
    foamContour: true,
    face: {
      eyes: "sleepy",
      arcW: 34,
      arcD: 18,
      eyeDx: 84,
      eyeY: 440,
      mouth: "small",
      mw: 26,
      md: 14,
      mouthY: 518,
      sw: 16,
    },
  },
  {
    slug: "06-slim-minimal-eyes",
    ...slim,
    foam: slimCap,
    foamColor: C.white,
    foamContour: true,
    face: {
      eyes: "oval",
      eyeRx: 22,
      eyeRy: 32,
      eyeDx: 58,
      eyeY: 450,
      shine: true,
      mouth: "none",
      sw: 15,
    },
  },
  {
    slug: "07-chubby-wink-drip",
    ...chubby,
    tilt: -8,
    foam: { ...chubbyOver, drip: [-170, 316, 448, 50] },
    foamColor: C.white,
    foamContour: true,
    face: {
      eyes: "wink",
      arcW: 32,
      arcD: 20,
      eyeR: 32,
      eyeDx: 84,
      eyeY: 432,
      shine: true,
      mouth: "smirk",
      mw: 50,
      md: 38,
      mouthY: 518,
      sw: 18,
    },
  },
  {
    slug: "08-chubby-cheer-bubbles",
    ...chubby,
    sidePanel: true,
    foam: {
      ...chubbyOver,
      bubbles: [
        [-262, 98, 22],
        [218, 72, 30],
      ],
    },
    foamColor: C.white,
    foamContour: true,
    face: {
      eyes: "happy",
      arcW: 34,
      arcD: 24,
      eyeDx: 84,
      eyeY: 428,
      blush: { dx: 150, dy: 40, rx: 34, ry: 20 },
      mouth: "grin",
      grinR: 74,
      mouthY: 512,
      sw: 18,
    },
  },
  {
    slug: "09-chubby-uwu-rounded",
    halfW: 230,
    bodyTop: 300,
    bottomY: 810,
    tip: false,
    foam: chubbyCap,
    foamColor: C.white,
    foamContour: true,
    face: {
      eyes: "happy",
      arcW: 32,
      arcD: 22,
      eyeDx: 82,
      eyeY: 435,
      blush: { dx: 146, dy: 44, rx: 34, ry: 20 },
      mouth: "small",
      mw: 30,
      md: 16,
      mouthY: 520,
      sw: 17,
    },
  },
  {
    slug: "10-stubby-outlined-bigface",
    ...stubby,
    outline: 13,
    facetDx: 150,
    scallops: [
      [-160, 28],
      [0, 32],
      [150, 28],
    ],
    foam: { ...stubbyOver, drip: [185, 330, 470, 56] },
    foamColor: C.white,
    face: {
      eyes: "dot",
      eyeR: 38,
      eyeDx: 95,
      eyeY: 448,
      shine: true,
      mouth: "smile",
      mw: 64,
      md: 44,
      mouthY: 545,
      sw: 20,
    },
  },
  {
    slug: "11-slim-writing-tilt",
    ...slim,
    tilt: 14,
    facetDx: 100,
    foam: slimCap,
    foamColor: C.white,
    foamContour: true,
    face: {
      eyes: "dot",
      eyeR: 23,
      eyeDx: 58,
      eyeY: 450,
      shine: true,
      shineR: 9,
      faceDx: 8,
      mouth: "small",
      mw: 30,
      md: 16,
      mouthY: 515,
      sw: 15,
    },
  },
  {
    slug: "12-stubby-badge",
    halfW: 268,
    bodyTop: 330,
    woodY: 600,
    tipY: 780,
    graphiteY: 715,
    tip: true,
    outline: 16,
    foam: badgeFoam,
    foamColor: C.white,
    face: {
      eyes: "dot",
      eyeR: 40,
      eyeDx: 100,
      eyeY: 455,
      shine: true,
      mouth: "grin",
      grinR: 72,
      mouthY: 538,
      sw: 22,
    },
  },
];

for (const v of VARIANTS) {
  const svg = buildVariant(v);
  fs.writeFileSync(path.join(OUT, `${v.slug}.svg`), svg);
  console.log("wrote", v.slug);
}
