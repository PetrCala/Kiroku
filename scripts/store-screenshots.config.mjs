/**
 * Configuration for `scripts/frame-app-store-screenshots.mjs`.
 *
 * Edit this file to change device sizes, locales, the visual theme, and the
 * caption text per screenshot. The raw (unframed) captures you feed in must
 * live at:  RAW_DIR/<locale>/<shot.raw>   (see paths below).
 *
 * IMPORTANT (Apple Guideline 2.3.3): the framed output composites your REAL
 * app captures onto a marketing background. Never replace the capture itself
 * with fabricated UI — the screenshot content must match the shipped app.
 */

// ─── Paths (relative to the repo root) ──────────────────────────────────────
const RAW_DIR = 'fastlane/store-screenshots/raw';
const OUT_DIR = 'fastlane/store-screenshots/framed';

// ─── Output device sizes (portrait, EXACT App Store pixel dimensions) ────────
// 6.9" satisfies the mandatory largest-iPhone slot and ASC will down-scale it
// for 6.7"/6.5". Add/remove sizes as needed.
const devices = [
  {id: '6.9', width: 1320, height: 2868}, // iPhone 16/17 Pro Max
  {id: '6.7', width: 1290, height: 2796}, // iPhone 15 Pro Max
];

// ─── Locales (must match RAW_DIR subfolders and caption keys below) ──────────
const locales = ['en-US', 'cs'];

// ─── Visual theme ───────────────────────────────────────────────────────────
const theme = {
  // Background gradient stops (top → bottom). Use one entry for a solid color.
  background: ['#6C4BF6', '#3D7BF0'],
  captionColor: '#FFFFFF',
  // Bold font already shipped in the app bundle (reused by generate-icons.mjs).
  captionFont: 'assets/fonts/native/ExpensifyNeue-Bold.otf',
  captionSizeRatio: 0.046, // caption font size as a fraction of canvas width
  captionMaxWidthRatio: 0.86, // wrap captions to this fraction of canvas width
  captionTopRatio: 0.07, // caption block top margin (fraction of height)
  gapRatio: 0.045, // gap between caption block and the screenshot
  bottomRatio: 0.06, // bottom margin below the screenshot
  screenshotMaxWidthRatio: 0.82, // screenshot width cap (fraction of canvas width)
  cornerRadiusRatio: 0.055, // screenshot corner radius (fraction of its width)
};

// ─── Screenshots, in store order ────────────────────────────────────────────
// `raw` is the filename inside RAW_DIR/<locale>/. `caption` is keyed by locale.
// Captions stay consistent with Kiroku's harm-reduction framing — never
// anything that celebrates drinking *volume*.
const shots = [
  {
    raw: '01-home.png',
    caption: {
      'en-US': 'Track every drinking session',
      cs: 'Sledujte každou relaci pití',
    },
  },
  {
    raw: '02-session.png',
    caption: {
      'en-US': 'Log drinks and units in seconds',
      cs: 'Zaznamenejte nápoje a jednotky během chvilky',
    },
  },
  {
    raw: '03-calendar.png',
    caption: {
      'en-US': 'See your full history at a glance',
      cs: 'Mějte celou historii na očích',
    },
  },
  {
    raw: '04-stats.png',
    caption: {
      'en-US': 'Understand your patterns over time',
      cs: 'Pochopte své vzorce v čase',
    },
  },
  {
    raw: '05-alcohol-free.png',
    caption: {
      'en-US': 'Celebrate your alcohol-free days',
      cs: 'Oslavte dny bez alkoholu',
    },
  },
  {
    raw: '06-profile.png',
    caption: {
      'en-US': 'Share progress with friends',
      cs: 'Sdílejte pokrok s přáteli',
    },
  },
];

export default {RAW_DIR, OUT_DIR, devices, locales, theme, shots};
