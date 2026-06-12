# Web E2E (Playwright)

Smoke suite for the react-native-web build: email/password sign-in plus
navigation across the four bottom tabs (Home, Friends, Statistics, Settings).

- **Run locally:** copy `.env.e2e.example` to `.env.e2e`, fill in a dev-backend
  account, then `npm run test:e2e:web` from the repo root. With no
  `PLAYWRIGHT_BASE_URL` set it auto-starts `npm run web` (http://localhost:8082);
  `npm run test:e2e:web:ui` opens the Playwright UI runner.
- **Point at a deployed build:** set `PLAYWRIGHT_BASE_URL` to a PR preview-channel
  URL (or a live site) and the suite runs against that instead of a local server.
  This is the same knob CI uses, and the same one to use for agent-driven
  verification (`preview_navigate` / Claude-in-Chrome) against a preview channel.
- **CI:** the `playwright` job in `.github/workflows/deployWeb.yml` runs this
  against the PR preview channel when a PR is labeled `Ready To Build - Web`.

Notes: the smoke flow (`tests/smoke.spec.ts`) runs at a mobile viewport
(393x852) -- the app's primary surface and the verified-clean layout from the
#934 / #1188 QA pass. The wide desktop layout is covered by
`tests/desktop-frame.spec.ts`, which drives the app at 1440x900 and asserts the
post-#1224 phone frame (#1219): above the 800px breakpoint the app renders its
mobile layout centered in a ~480px column rather than leaving an empty central
pane. The sign-in session is cached once per worker (`.auth/user.json`) so
navigation tests skip the login flow.

## Fast iteration (live dev server)

The suite is designed for a hot-reload loop against `npm run web` -- no
production rebuild or preview deploy per change:

1. Start the dev server once (`npm run web`; the Playwright config auto-starts
   it if nothing is on :8082, and reuses it if something is). A warm webpack
   cache compiles in ~30 s; after that, `src/` edits hot-rebuild in ~2 s.
2. Run tests against it: `npm run test:e2e:web` (full suite a few minutes the
   first time, including the one-time sign-in). The session is cached in
   `.auth/user.json`, so subsequent runs skip login -- a targeted run such as
   `npx playwright test --config=e2e/web/playwright.config.ts -g "Statistics"`
   completes in seconds.
3. Iterate: edit `src/`, wait for the webpack recompile line, re-run the
   targeted test.

Working from a git worktree: symlink the shared checkout's `node_modules`,
`.env.development`, and `e2e/web/.env.e2e` into the worktree first -- the dev
server and this config read all three.

To reproduce a CI failure locally, point the suite at the preview channel
itself: `PLAYWRIGHT_BASE_URL=https://kiroku-app-dev--pr-<n>-<hash>.web.app npm
run test:e2e:web`. Failures land in `e2e/web/test-results/` with a screenshot,
video, and error context.

Environment caveat: `npm run web` authenticates against the **dev** Firebase
project (`.env.development`), while CI preview channels are built from the
staging env secret. A test account must exist in whichever backend the build
under test points at. Dev-only console noise (e.g. React dev-mode deprecation
warnings) is filtered via `BENIGN_CONSOLE_PATTERNS` in
`fixtures/consoleErrors.ts`.
