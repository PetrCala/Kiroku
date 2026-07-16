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

// ─── Locales (RAW_DIR/<platform>/<locale> subfolders + caption keys below) ───
const locales = ['en-US', 'cs'];

// `captureLocales` maps each framing locale above to the locale folder the
// capture tools write (fastlane snapshot/screengrab emit `en-US` / `cs-CZ`; the
// framing pipeline — and the Google Play `cs-CZ` listing — reuse this map).
const captureLocales = {'en-US': 'en-US', cs: 'cs-CZ'};

// ─── Platforms ───────────────────────────────────────────────────────────────
// Each platform has its own captures (different app UI) and its own framed
// output sizes, so raw/ and framed/ are split by platform:
//   raw/<platform>/<locale>/<shot.raw>      framed/<platform>/<locale>/<device>/
// - captureDir    — where the capture tool writes (snapshot / screengrab).
// - sourceDevice  — capture subfolder to read (iOS; null = single device).
// - captureLayout — 'device' (snapshot: <locale>/<device>/<snap>.png) or
//                   'images' (screengrab: <locale>/images/<snap>.png).
// - devices       — framed output sizes. iOS uses EXACT App Store dimensions;
//                   Android must stay ≤ 2:1 or Google Play rejects it (the 6.9"
//                   iPhone frame is 2.17:1).
const platforms = {
  ios: {
    captureDir: 'fastlane/screenshots/ios',
    sourceDevice: 'iPhone 17 Pro Max',
    captureLayout: 'device',
    devices: [
      {id: '6.9', width: 1320, height: 2868}, // iPhone 16/17 Pro Max
      {id: '6.7', width: 1290, height: 2796}, // iPhone 15 Pro Max
      // Apple Watch (DEFERRED — Apple Watch MVP Phase 6.3). The watchOS
      // companion ships as a non-functional UI shell, so watch App Store
      // screenshots are intentionally NOT captured yet. When it's functional,
      // add the ASC watch slot here (Series 7+/Ultra is 410×502) AND a watch
      // simulator entry to fastlane/Snapfile; framing/upload then needs a
      // watch-shaped frame + caption. Until then, stays commented out.
      // {id: 'watch', width: 410, height: 502}, // Apple Watch Series 7+/Ultra
    ],
  },
  android: {
    captureDir: 'fastlane/screenshots/android',
    sourceDevice: null,
    captureLayout: 'images',
    devices: [
      {id: 'phone', width: 1080, height: 2160}, // 2:1 — within Google Play's limit
    ],
  },
};

// ─── Visual theme ───────────────────────────────────────────────────────────
const theme = {
  // Background gradient stops (top → bottom). Use one entry for a solid color.
  // Kiroku brand gold (`yellowStrong` #F5C400) → deeper amber.
  background: ['#FFD23F', '#F5A623'],
  captionColor: '#1A1A1A', // dark text reads cleanly on the gold background
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
// `snapshot` is the capture name the UI test emits (ios/KirokuUITests/
// ScreenshotTests.swift → `<snapshot>.png`); the ingest mapper copies it to
// `raw` (the filename inside RAW_DIR/<locale>/). `caption` is keyed by locale.
// Captions stay consistent with Kiroku's harm-reduction framing — never
// anything that celebrates drinking *volume*.
//
// 6-screen set. Each `snapshot` is captured by the UI tests (Swift + Kotlin) in
// this exact order. The tests also capture `05_Settings`, which is intentionally
// not a marketing shot and therefore not mapped here.
const shots = [
  {
    snapshot: '01_Home',
    raw: '01-home.png',
    caption: {
      'en-US': 'See your drinking clearly',
      cs: 'Mějte přehled o svém pití',
    },
  },
  {
    snapshot: '02_LiveSession',
    raw: '02-session.png',
    caption: {
      'en-US': 'Log a drink in seconds',
      cs: 'Zaznamenejte nápoj během chvilky',
    },
  },
  {
    snapshot: '03_DayOverview',
    raw: '03-day-overview.png',
    caption: {
      'en-US': 'Know exactly what you drink',
      cs: 'Vězte přesně, co pijete',
    },
  },
  {
    snapshot: '04_Statistics',
    raw: '04-stats.png',
    caption: {
      'en-US': 'Track your progress every week',
      cs: 'Sledujte svůj pokrok každý týden',
    },
  },
  {
    snapshot: '05_AlcoholFree',
    raw: '05-alcohol-free.png',
    caption: {
      'en-US': 'Watch your alcohol-free days add up',
      cs: 'Sledujte, jak přibývají dny bez alkoholu',
    },
  },
  {
    snapshot: '06_Profile',
    raw: '06-profile.png',
    caption: {
      'en-US': 'Stay on track with friends',
      cs: 'Zůstaňte na správné cestě s přáteli',
    },
  },
];

export default {
  RAW_DIR,
  OUT_DIR,
  platforms,
  locales,
  theme,
  shots,
  captureLocales,
};
