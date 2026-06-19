# Native E2E — proposal (not yet wired)

> **Status: proposal + starter flow, not a running harness.** The flow in
> [`flows/`](./flows) is a concrete starting point written against the real app,
> but it has **not** been executed against a simulator/emulator or in CI yet.
> Standing the runner up needs a device/simulator and a built app, which the
> authoring environment didn't have — so this is deliberately delivered as a
> documented path to expand rather than a half-working harness. Everything below
> is what's needed to make it real.

## Why native E2E (what the web suite can't catch)

The Playwright web suite ([`../web`](../web)) covers the launch-critical flows
that render on react-native-web. But Kiroku's most painful recurring bugs are
**native boot/navigation races** that only exist on device:

- splash-screen / auth-gate deadlock on cold boot,
- the iOS tab-switch "fly to top-left" zoom on root tabs,
- first-run empty-state flashes (friends list, onboarding),
- native modal/RHP transition freezes.

None of these reproduce on web, so native coverage has unique value for the App
Store launch. A single green smoke flow on a real iOS simulator + Android
emulator would guard the boot → sign-in → core-loop path that a store reviewer
(and every new user) hits first.

## Tool choice: Maestro

| Tool        | Verdict        | Why                                                                                                                                                                                     |
| ----------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Maestro** | ✅ recommended | YAML flows, zero app instrumentation, built-in waits/retries (less flake), trivial local install, one CLI for iOS + Android, [Maestro Cloud] option. Lowest lift for a solo maintainer. |
| Detox       | ❌             | Gray-box; needs native build integration, a JS test runner, and per-RN-version upkeep. Heavy for one smoke flow.                                                                        |
| Appium      | ❌             | Powerful but verbose (WebDriver), heavier setup, more flake to manage.                                                                                                                  |

Maestro matches elements by `text:` (the on-screen / accessibility label) or
`id:` (RN `testID` → `resource-id` on Android, `accessibilityIdentifier` on
iOS). **The `testID`s this PR added for the web suite are reused verbatim as
Maestro `id:` matchers** — `add-drink-<key>`, `session-total-units`,
`summary-edit-session`, `calendar-day-<date>` — so the two suites share one set
of stable selectors.

[Maestro Cloud]: https://docs.maestro.dev/cloud/run-maestro-tests-in-the-cloud

## First flow

[`flows/sign_in_log_session.yaml`](./flows/sign_in_log_session.yaml) drives
launch → email/password sign-in → start a live session → log a drink → save,
asserting the saved unit count — the native mirror of the web lifecycle test.

### Auth in automation — keep it email/password

Use the **dev** Firebase project and a dev test account (the same
`E2E_TEST_*` credentials the web suite uses). Avoid scripting Google / Apple
sign-in:

- Google SSO throws `DEVELOPER_ERROR` on ad-hoc builds when the signing SHA
  isn't registered for the variant's Firebase app.
- Apple-on-Android is a web OAuth popup (not a native sheet), which Maestro
  can't drive reliably.

The email/password form is fully native and deterministic. Like the web build,
dev/ad-hoc builds re-show the **email-verification gate** ("Skip verification
(dev only)") and may show the **terms** sheet — the flow clears both, mirroring
`e2e/web/fixtures/devGates.ts`.

## Local setup

```bash
# 1. Install Maestro (https://docs.maestro.dev/getting-started/installing-maestro)
curl -fsSL "https://get.maestro.mobile.dev" | bash

# 2. Build & install a debug/dev app onto a booted simulator/emulator.
#    Android dev variant applicationId: com.alcohol_tracker.dev
npm run android            # or: npm run ios
#    (or install a CI ad-hoc APK — see the android-test-apk notes)

# 3. Provide the dev test account (same values as e2e/web/.env.e2e)
export MAESTRO_APP_ID=com.alcohol_tracker.dev      # iOS: confirm the dev bundle id
export E2E_TEST_EMAIL=...                            # dev-backend account
export E2E_TEST_PASSWORD=...

# 4. Run the flow
maestro test e2e/native/flows/sign_in_log_session.yaml
```

`maestro studio` is the fastest way to discover/verify selectors against the
running app while expanding flows.

## CI plan

Add a manually-/label-gated workflow (mirror `deployWeb.yml`'s
`Ready To Build - Web` gating — **not** every PR; device runners are slow/costly):

- **Android** — `ubuntu-latest` + `reactivecircus/android-emulator-runner` (KVM
  acceleration). Build the dev/ad-hoc APK (or pull the CI ad-hoc APK from S3),
  `maestro test`, upload the Maestro report + a recording artifact.
- **iOS** — `macos-14`, boot an iOS simulator, build the dev scheme, `maestro
test`. macOS minutes are expensive, so gate this tightly (label or
  `workflow_dispatch`).
- Inject `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` from repo secrets (already exist
  for the web job). Point the build at the **dev** Firebase env so the dev test
  account authenticates (same constraint as the web preview job).
- [Maestro Cloud] is the lower-maintenance alternative to self-hosted device
  runners if budget allows.

## Effort estimate

| Step                                                                            | Estimate      |
| ------------------------------------------------------------------------------- | ------------- |
| Validate `sign_in_log_session.yaml` locally on a sim/emulator (selector fixups) | 0.5 day       |
| Add 2–3 more flows (onboarding/first-run, tab tour, calendar→day-overview)      | 0.5–1 day     |
| Android CI job (emulator-runner)                                                | 0.5–1 day     |
| iOS CI job (macOS runner) + tighten gating/artifacts                            | 1 day         |
| **Total to a gated, green native smoke suite**                                  | **~3–4 days** |

## Why this wasn't built here

Building it requires a booted simulator/emulator and a compiled app — neither
was available in the authoring environment, and `maestro test` can't be
verified without them. Per the brief's guidance, a native harness that can't be
run is worse than an honest proposal, so the web suite (Path A) was completed
and verified instead, and this is left as a scoped follow-up.
