# Maestro end-to-end tests

End-to-end coverage for the Kiroku sign-up and onboarding flows, run via
[Maestro](https://maestro.mobile.dev). v1 targets Android only against the
**staging** build, which points at the **dev** Firebase project.

## Local setup

```bash
npm run e2e:setup            # installs Maestro CLI (curl from mobile.dev)
npm run android              # produces a stagingDebug APK on a running emulator
npm run e2e:android          # runs all flows via scripts/maestro/run.ts
FLOWS=signup-email-password npm run e2e:android   # single flow
```

You need a running Android emulator (`npm run startAndroidEmulator`) and the
staging APK installed before running flows. `FIREBASE_DEV_ADMIN_SA` must be
exported in your environment (single-line service-account JSON for the dev
Firebase project) so the orchestrator can seed and tear down test users.

## Layout

- `flows/` — YAML flow files, one per scenario. Each consumes `EMAIL`,
  `PASSWORD` env vars injected by the orchestrator.
- `config.yaml` — Maestro workspace config.
- The orchestrator lives at `scripts/maestro/run.ts`. It generates a unique
  `maestro+<runId>-<flow>@kiroku.test` per flow, seeds Firebase Auth for
  flows that need an existing user, runs the flow, and tears the user down
  in a `finally` so failures don't leak state.

## Maestro YAML conventions

- Reference elements by `id:` matching a key in `CONST.TEST_IDS`. Use text
  matching only for buttons rendered by shared form components (e.g.
  `tapOn: "Create account"`) until we thread testID through `FormWrapper`.
- New flows: add a `tags:` block (`smoke`, `signup`, `login`, …) so we can
  filter in CI as the suite grows.

## Out of scope for v1

- iOS (planned for PR 2).
- Email verification flow (needs Admin-SDK link generation — PR 2).
- Google and Apple Sign-In (system-modal native UI; will need mocked
  providers in a separate build flavor).
- Locale variants (flows assume English defaults).
