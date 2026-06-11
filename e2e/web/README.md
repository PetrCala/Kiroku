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
