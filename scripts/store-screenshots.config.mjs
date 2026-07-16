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
//
// `kind` scopes which shots render on a device: a shot renders on a device only
// when their kinds match ('phone' is the default for both). This keeps the four
// iPhone shots off the tiny watch slot and the single watch shot off the phones.
const devices = [
  {id: '6.9', width: 1320, height: 2868, kind: 'phone'}, // iPhone 16/17 Pro Max
  {id: '6.7', width: 1290, height: 2796, kind: 'phone'}, // iPhone 15 Pro Max
  // ─── Apple Watch (Apple Watch MVP Phase 6.3) ──────────────────────────────
  // The watchOS companion is a functional remote (MVP Phases 4 and 5), so the
  // watch is embedded in the App Store build again and ASC now requires an Apple
  // Watch screenshot (APP_WATCH_SERIES_4) before the iOS version can be
  // submitted. Size is the Series 7+/Ultra slot (410×502, portrait). Unlike the
  // iPhone shots, the watch capture is taken MANUALLY (see the watch shot below
  // and contributingGuides/SCREENSHOTS.md): a watchOS `snapshot` UI test can't
  // drive a phone-tethered remote, and an unpaired sim only shows the reconnect
  // screen. Drop the real capture at RAW_DIR/<locale>/watch.png, then frame.
  {id: 'watch', width: 410, height: 502, kind: 'watch'}, // Apple Watch Series 7+/Ultra
];

// ─── Locales (must match RAW_DIR subfolders and caption keys below) ──────────
const locales = ['en-US', 'cs'];

// ─── Capture-side identifiers (single-source the fastlane `snapshot` matrix) ──
// The ingest mapper (scripts/ingest-store-screenshots.mjs) reads fastlane
// `snapshot` output and copies it into RAW_DIR. `captureLocales` maps each
// framing locale above to the locale folder `snapshot` writes (it emits
// `en-US` / `cs-CZ`; the framing pipeline uses `en-US` / `cs`).
// `captureSourceDevice` is the iPhone folder to read from — the 6.9"/1320×2868
// master that every output size is derived from, so the iPad capture is not
// consumed here. Keep this in sync with the first device in fastlane/Snapfile.
const captureLocales = {'en-US': 'en-US', cs: 'cs-CZ'};
const captureSourceDevice = 'iPhone 17 Pro Max';

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
// This is the current 4-screen set (the screens we already capture). The
// captured `05_Settings` is intentionally left unmapped. Growing to the full
// marketing set (Statistics, alcohol-free streak) needs new captures and lands
// in a follow-up PR alongside a CI capture run.
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
    snapshot: '04_Profile',
    raw: '04-profile.png',
    caption: {
      'en-US': 'Stay on track with friends',
      cs: 'Zůstaňte na správné cestě s přáteli',
    },
  },
  // Apple Watch shot (kind: 'watch'). Renders ONLY on the watch device, and is
  // skipped by the ingest mapper because it has no fastlane `snapshot` source.
  // Capture it by hand from the `Kiroku Watch App` target running in a watch
  // simulator paired with a signed-in phone (so it shows a live session, not the
  // reconnect screen), then drop it at RAW_DIR/<locale>/watch.png. The Czech
  // caption is a first pass; run the translation-review skill before shipping.
  {
    kind: 'watch',
    raw: 'watch.png',
    caption: {
      'en-US': 'Log a drink from your wrist',
      cs: 'Zaznamenejte nápoj přímo z hodinek',
    },
  },
];

export default {
  RAW_DIR,
  OUT_DIR,
  devices,
  locales,
  theme,
  shots,
  captureLocales,
  captureSourceDevice,
};
