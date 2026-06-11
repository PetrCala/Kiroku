import {defineConfig, devices} from '@playwright/test';
import * as path from 'node:path';
import dotenv from 'dotenv';

// Load local-only config (test-account credentials, optional base URL) from
// e2e/web/.env.e2e. In CI these values come from the job environment / GitHub
// secrets instead, so a missing file here is expected and not an error.
dotenv.config({path: path.resolve(__dirname, '.env.e2e')});

// Where the suite points.
//   - Local dev: defaults to the webpack dev server (`npm run web` ->
//     http://localhost:8082), which this config will auto-start if nothing is
//     already serving there.
//   - CI: set to the PR preview-channel URL by the `playwright` job in
//     .github/workflows/deployWeb.yml.
//   - Agent-driven verification: point PLAYWRIGHT_BASE_URL at any preview
//     channel or live site to drive that build instead.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8082';

// Only auto-start a local dev server when no external base URL was supplied.
// CI and agent runs target an already-deployed URL and must not boot webpack.
const shouldStartLocalServer = !process.env.PLAYWRIGHT_BASE_URL;

// We deliberately drive the app at a MOBILE viewport. The wide desktop layout
// has a known open bug (#1219: the tab roots stay pinned to a ~375px left
// column, leaving the central pane empty), so testing at desktop width would
// flap on a defect that is not ours to assert on here. 393x852 is the
// verified-clean layout from the #934 / #1188 web QA pass.
const MOBILE_VIEWPORT = {width: 393, height: 852};

export default defineConfig({
  testDir: './tests',
  outputDir: path.resolve(__dirname, 'test-results'),
  // The suite signs into a single shared dev account, so parallel sessions
  // would race on the same backend state. Keep it serial.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The web app loads ~8MB of CanvasKit WASM before boot (Skia charts), so the
  // first authenticated navigation is slow. Budget generously.
  timeout: 90_000,
  expect: {timeout: 15_000},
  reporter: process.env.CI
    ? [
        [
          'html',
          {
            open: 'never',
            outputFolder: path.resolve(__dirname, 'playwright-report'),
          },
        ],
        ['list'],
      ]
    : [['list']],
  use: {
    baseURL,
    headless: true,
    viewport: MOBILE_VIEWPORT,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // Desktop Chrome engine (mouse interactions, no touch emulation), driven
      // at the mobile viewport above. We do not run Firefox/WebKit in this
      // initial pass; cross-browser is a follow-up.
      use: {...devices['Desktop Chrome'], viewport: MOBILE_VIEWPORT},
    },
  ],
  webServer: shouldStartLocalServer
    ? {
        command: 'npm run web',
        cwd: path.resolve(__dirname, '..', '..'),
        url: 'http://localhost:8082',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
});
