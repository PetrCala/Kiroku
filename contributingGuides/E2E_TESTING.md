# End-to-end testing (Maestro)

Kiroku's E2E suite uses [Maestro](https://maestro.mobile.dev) to drive the
real app on an Android emulator. Flows live in `.maestro/flows/`. The
suite runs on every PR via `.github/workflows/e2eAndroid.yml` against the
**staging** Android variant pointed at the **dev** Firebase project.

## Why Maestro

- YAML flows are an order of magnitude less code than Detox tests and
  don't compile against app source, so they don't break on TypeScript
  refactors.
- Free and open source. No Maestro Cloud dependency for the suite to run.
- The Maestro CLI ships with screenshot/video capture, which lands as
  GitHub Actions artifacts when a flow fails.

## Running locally

```bash
# One-time
npm run e2e:setup

# Bring up an emulator and install a staging build
npm run startAndroidEmulator
cd android && ./gradlew :app:assembleStagingDebug && cd ..
adb install -r android/app/build/outputs/apk/staging/debug/app-staging-debug.apk

# Export the dev Firebase admin service-account JSON as a single line
export FIREBASE_DEV_ADMIN_SA='{"type":"service_account",...}'

# Run all flows
npm run e2e:android

# Run a single flow
FLOWS=signup-email-password npm run e2e:android
```

The orchestrator at `scripts/maestro/run.ts` generates a unique
`maestro+<runId>-<flow>@kiroku.test` per flow, pre-seeds users for flows
that need them (login, forgot-password), runs the flow, and tears the
user down in a `finally` so failed flows don't leak.

## Adding new flows

1. Create `.maestro/flows/<your-flow>.yaml`.
2. Reuse testIDs from `CONST.TEST_IDS` rather than asserting on visible
   text — flows must survive copy and translation changes.
3. If your flow needs additional testIDs, add them to `CONST.TEST_IDS`
   and the relevant screen in the same PR.
4. If your flow needs a pre-seeded user, add the flow basename to the
   `PRE_SEEDED` set in `scripts/maestro/run.ts`.
5. Tag the flow (`tags: [smoke, signup, ...]`) so we can filter as the
   suite grows.

## Known limitations (tracked separately)

- **iOS coverage**: deferred to a follow-up PR (macOS runners + Xcode
  toolchain doubles CI cost; Android catches most regressions first).
- **Email verification flow**: needs the Admin SDK to generate the
  verification link without a real inbox. Deferred to PR 2.
- **Google and Apple Sign-In**: render system-modal native UI that
  Maestro cannot reliably drive. Plan: a "maestro" build flavor that
  swaps the real providers for mocks so the post-OAuth code path stays
  covered.
- **Locale variants**: flows assume English defaults. Submit buttons
  match by visible text because the shared `FormWrapper` doesn't yet
  thread a `submitButtonTestID`. Once it does, these matchers become
  locale-agnostic.

## CI

- Workflow: `.github/workflows/e2eAndroid.yml`
- Required secrets:
  - `STAGING_ENV_FILE` — full `.env.staging` contents (multi-line)
  - `FIREBASE_DEV_ADMIN_SA` — dev Firebase service-account JSON, single
    line. Generate at Firebase Console → Project settings → Service
    accounts → Generate new private key.
- Adding the workflow as a required status check on `master` is done
  via branch protection, separately from this PR.
- Failure artifacts (screenshots, video, command logs) are uploaded to
  the workflow run with a 7-day retention.
