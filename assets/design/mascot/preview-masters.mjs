/**
 * Renders the three committed masters for visual review (not part of the
 * icon pipeline): each at 512px + 64px on white and on the #0D1117 icon
 * background, composed into a single review sheet at /tmp/mascot-masters.png.
 * The silhouette is also rendered tinted-on-dark to preview Android
 * notification/themed-icon treatment.
 *
 * Run from the repo root: node assets/design/mascot/preview-masters.mjs
 */
import path from 'path';
import {fileURLToPath} from 'url';
import {createRequire} from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const IMG = path.join(REPO_ROOT, 'assets/images');
const DARK = '#0D1117';
const LIGHT = '#FFFFFF';

const masters = ['app-logo.svg', 'app-icon.svg', 'app-logo-silhouette.svg'];

async function tile(svgPath, size, bg) {
  return sharp(fs.readFileSync(svgPath))
    .resize(size, size)
    .flatten({background: bg})
    .png()
    .toBuffer();
}

async function main() {
  const t = 300;
  const small = 64;
  const pad = 16;
  const cols = masters.length;
  const rows = 2; // light row, dark row
  const W = cols * (t + small + 2 * pad) + pad;
  const H = rows * (t + pad) + pad + 36;
  const comps = [];
  for (let i = 0; i < masters.length; i++) {
    const p = path.join(IMG, masters[i]);
    const x0 = pad + i * (t + small + 2 * pad);
    for (const [row, bg] of [
      [0, LIGHT],
      [1, DARK],
    ]) {
      const y0 = pad + row * (t + pad);
      comps.push({input: await tile(p, t, bg), left: x0, top: y0});
      comps.push({
        input: await tile(p, small, bg),
        left: x0 + t + pad,
        top: y0,
      });
    }
    const label = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="30"><text x="0" y="22" font-family="Helvetica" font-size="20" fill="#333">${masters[i]}</text></svg>`,
    );
    comps.push({
      input: await sharp(label).png().toBuffer(),
      left: x0,
      top: H - 32,
    });
  }
  await sharp({
    create: {width: W, height: H, channels: 3, background: '#E8E8E6'},
  })
    .composite(comps)
    .png()
    .toFile('/tmp/mascot-masters.png');
  console.log('wrote /tmp/mascot-masters.png');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
