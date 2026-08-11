/**
 * Configuration for `scripts/frame-app-store-screenshots.mjs`.
 *
 * Edit this file to change device sizes, locales, the visual theme, and the
 * caption text per screenshot. The raw (unframed) captures you feed in must
 * live at:  RAW_DIR/<locale>/<shot.raw>   (see paths below).
 *
 * IMPORTANT (Apple Guideline 2.3.3): the framed output composites your REAL
 * app captures onto a marketing background. Never replace the capture itself
 * with fabricated UI: the screenshot content must match the shipped app.
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
  // watch is embedded in the App Store build again and ASC refuses the iOS
  // submission until an Apple Watch screenshot exists. The refusal names
  // APP_WATCH_SERIES_4 specifically, so all three watch slots are rendered from
  // the same capture: uploading the extra two costs nothing and removes the
  // guesswork about which one Apple is actually asking for.
  //
  // Unlike the iPhone shots, the watch capture does not come from fastlane
  // `snapshot` (a watchOS UI test can't drive a phone-tethered remote, and an
  // unpaired sim only shows the reconnect screen). The `watch` job of
  // screenshots.yml captures it from a paired simulator pair with `simctl io`
  // (see contributingGuides/SCREENSHOTS.md; manual capture into
  // RAW_DIR/<locale>/watch.png stays a valid fallback). Each output is
  // exact-size, which is how `asc.mjs shots` knows the slot to file it under.
  {id: 'watch-368', width: 368, height: 448, kind: 'watch'}, // APP_WATCH_SERIES_4
  {id: 'watch-396', width: 396, height: 484, kind: 'watch'}, // APP_WATCH_SERIES_7
  {id: 'watch-410', width: 410, height: 502, kind: 'watch'}, // APP_WATCH_ULTRA
];

// ─── Locales (must match RAW_DIR subfolders and caption keys below) ──────────
const locales = ['en-US', 'cs'];

// ─── Capture-side identifiers (single-source the fastlane `snapshot` matrix) ──
// The ingest mapper (scripts/ingest-store-screenshots.mjs) reads fastlane
// `snapshot` output and copies it into RAW_DIR. `captureLocales` maps each
// framing locale above to the locale folder `snapshot` writes (it emits
// `en-US` / `cs-CZ`; the framing pipeline uses `en-US` / `cs`).
// `captureSourceDevice` is the iPhone folder to read from, the 6.9"/1320×2868
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

// ─── Demo-account data contract (READ BEFORE ANY CAPTURE RUN) ───────────────
// Captures come from the live `APPLE_DEMO_*` account, so that account's data IS
// the marketing copy. In 2026-07 the shipped set was captured from an account
// whose data actively worked against the app: a friend list of seven people each
// labelled "1h sober" / "2Y sober", a month totalling 84.5 units, single days of
// 33.2 and 23.5 units, and a session itemising 33 drinks. Apple rejected the
// version under Guideline 1.4 (Physical Harm) saying the app is "marketed as a
// blood alcohol content calculator"; a per-person sobriety timer published as a
// screenshot is the most plausible thing a reviewer read that way.
//
// Before dispatching a capture, shape the demo account so every shot shows a
// person who is MODERATING. Concrete targets (units-to-colors defaults are
// yellow=5, orange=10, from src/libs/actions/User.ts):
//
//   • Alcohol-free days must dominate: >= 20 green days in the captured month.
//   • 8-10 drinking sessions in the month, ~30 units TOTAL (not 85).
//   • NO red day tiles (a red tile means >10 units in one day) and NO black
//     tiles (black = the self-reported blackout flag). Yellow, with at most one
//     orange, is the look we want.
//   • The biggest single session stays <= 5 units, i.e. 2-3 drinks. Never
//     capture a session summary itemising double-digit drink counts.
//   • Friend rows must read as elapsed time since a logged session ("3h" /
//     "last session"), never as a claim about anyone's bodily state. If a
//     capture shows the word "sober" next to a person, the build predates the
//     fix and MUST NOT be uploaded.
//
// ─── Screenshots, in store order ────────────────────────────────────────────
// `snapshot` is the capture name the UI test emits (ios/KirokuUITests/
// ScreenshotTests.swift → `<snapshot>.png`); the ingest mapper copies it to
// `raw` (the filename inside RAW_DIR/<locale>/). `caption` is keyed by locale.
// Captions stay consistent with Kiroku's harm-reduction framing, never
// anything that celebrates drinking *volume*.
//
// Six store shots, matching what the UI test captures. `07_Settings` is
// captured but intentionally left unmapped: it sells nothing.
//
// Shot order matters on the store page, so it runs from what the app is
// (calendar, logging, detail) to what it gives back (statistics, alcohol-free
// days) and only then to the social feature.
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
    raw: '04-statistics.png',
    caption: {
      'en-US': 'See the patterns behind the numbers',
      cs: 'Objevte vzorce za čísly',
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
    snapshot: '06_Friends',
    raw: '06-friends.png',
    caption: {
      'en-US': 'Stay on track with friends',
      cs: 'Zůstaňte na správné cestě s přáteli',
    },
  },
  // Apple Watch shot (kind: 'watch'). Renders ONLY on the watch devices. It has
  // no fastlane `snapshot` source; the `watch` CI job captures it to
  // fastlane/screenshots/ios/watch/watch.png and the ingest mapper fans that
  // one file out to RAW_DIR/<locale>/watch.png for every locale (the watch UI
  // follows the watch simulator's system locale; only this caption is
  // localized). The Czech caption is a first pass; run the translation-review
  // skill before shipping.
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
