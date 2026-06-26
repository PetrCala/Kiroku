# Apple Watch — signing, CI & store plumbing (MVP Phase 6)

Code-signing and CI/store wiring for the embedded `Kiroku Watch App` target
(added in Phase 1). This unblocks signed dev/adhoc/prod builds that embed the
watch. See [`docs/apple-watch-mvp.md`](apple-watch-mvp.md) for the overall MVP
and [`.claude/skills/ios-signing`](../.claude/skills/ios-signing/SKILL.md) for
the signing tool reference.

The watch needs **no Firebase, no GoogleService-Info, no extra pod** — it gets
its token from the phone (WatchConnectivity), so signing is the only iOS-platform
work to make it ship.

## What this wires (6.2 — done in code)

| Layer                                  | Change                                                                                                                                                                                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ios/kiroku.xcodeproj/project.pbxproj` | The watch target's `PROVISIONING_PROFILE_SPECIFIER[sdk=watchos*]` per config: Release/ReleaseProduction/ReleaseDevelopment → `KirokuWatch`, ReleaseAdHoc → `KirokuWatch_AdHoc`, Debug/DebugProduction/DebugDevelopment → `KirokuWatch_Development`. |
| `fastlane/Fastfile`                    | `beta` (prod) installs `KirokuWatch.mobileprovision` + maps `…watchkitapp → KirokuWatch`; `build_internal` (ad-hoc) installs `KirokuWatch_AdHoc.mobileprovision` + maps `…adhoc.watchkitapp → KirokuWatch_AdHoc`.                                   |
| `.github/workflows/platformDeploy.yml` | Decrypts `KirokuWatch.mobileprovision.gpg` (App Store / TestFlight lane).                                                                                                                                                                           |
| `.github/workflows/testBuild.yml`      | Decrypts `KirokuWatch_AdHoc.mobileprovision.gpg` (ad-hoc test-build lane).                                                                                                                                                                          |
| `scripts/ios-signing.mjs`              | New `watch-setup` command; `renew`/`check` now cover the two distribution watch profiles automatically.                                                                                                                                             |

The build matrix (which scheme archives which config):

| Scheme                 | Archive config       | Phone profile  | Watch profile       |
| ---------------------- | -------------------- | -------------- | ------------------- |
| `Kiroku (production)`  | `ReleaseProduction`  | `Kiroku`       | `KirokuWatch`       |
| `Kiroku (AdHoc)`       | `ReleaseAdHoc`       | `Kiroku_AdHoc` | `KirokuWatch_AdHoc` |
| `Kiroku (development)` | `ReleaseDevelopment` | `Kiroku`       | `KirokuWatch`       |

## What you must run once (6.1 — registers App IDs + mints profiles)

The provisioning profiles don't exist yet (Phase 1 deleted the stale 2–3-year-old
ones). Mint them with the signing tool — this registers the two watch App IDs and
re-encrypts the committed `ios/KirokuWatch*.mobileprovision.gpg`:

```bash
# from the MAIN checkout (the gitignored plaintext ASC key lives there)
export LARGE_SECRET_PASSPHRASE=...        # the GPG passphrase (or pass --passphrase)
node scripts/ios-signing.mjs watch-setup            # dry run — review the plan
node scripts/ios-signing.mjs watch-setup --yes      # execute
git add ios/KirokuWatch*.mobileprovision.gpg && git commit
```

`watch-setup` mints:

- **`KirokuWatch`** (App Store, App ID `…watchkitapp`) and **`KirokuWatch_AdHoc`**
  (ad-hoc, App ID `…adhoc.watchkitapp`) against the existing valid Apple
  Distribution cert — the two CI-critical profiles.
- **`KirokuWatch_Development`** (App ID `…watchkitapp`) against an Apple
  Development cert, best-effort — skipped with a note if no dev cert exists
  (local Debug only; CI never builds the Debug configs).

It needs the ASC API key to have the **Admin** role (App ID creation); a 403
prints the manual-portal fallback. The App IDs need **no capabilities**.

Future yearly renewals are automatic: `renew` regenerates `KirokuWatch` and
`KirokuWatch_AdHoc` alongside the phone profiles off the same new cert. Re-mint
`KirokuWatch_Development` with `watch-setup` when it expires.

## Verify the embedded watch app signs (6.2 acceptance)

After `watch-setup` + commit, the green check is a successful ad-hoc test build
([`testBuild.yml`](../.github/workflows/testBuild.yml), `assembleAdhocRelease`'s
iOS sibling) that embeds a correctly-signed watch app. To verify a built `.ipa`
locally:

```bash
unzip -q kiroku.ipa -d /tmp/kiroku-ipa
APP=/tmp/kiroku-ipa/Payload/*.app/Watch/*.app
# 1) the watch .app embeds a provisioning profile…
security cms -D -i $APP/embedded.mobileprovision | plutil -extract Name raw -o - -
# 2) …and is signed by the expected identity
codesign -dvvv $APP 2>&1 | grep Authority
# 3) entitlements match the watch App ID
codesign -d --entitlements :- $APP | plutil -extract 'application-identifier' raw -o - -
```

Expect the profile `Name` to be `KirokuWatch_AdHoc` (ad-hoc) / `KirokuWatch`
(App Store), an `Apple Distribution: …` authority, and the
`application-identifier` to end in `.watchkitapp` (or `.adhoc.watchkitapp`).

## Deferred — store metadata (6.3)

The watch app is a **non-functional UI shell** until the MVP logic lands
(Phases 2–5), so it is **premature to put it on the App Store listing**. Deferred
until the watch works:

- **Watch screenshots.** A seam is staged in
  [`scripts/store-screenshots.config.mjs`](../scripts/store-screenshots.config.mjs)
  (commented-out Apple Watch device entry). To enable: add a watch simulator to
  `fastlane/Snapfile`, uncomment the device, and add a watch-shaped frame +
  caption. Then run the usual capture → ingest → frame → upload pipeline (see the
  [`store-screenshots`](../.claude/skills/store-screenshots/SKILL.md) skill).
- **watchOS App Store listing fields.** App Store Connect exposes watch-specific
  promotional text / screenshots under the same app version. Fill these via the
  [`asc`](../.claude/skills/asc/SKILL.md) skill once a functional build is on
  TestFlight.

Submitting watch screenshots for a shell would also risk the kind of "feature not
present in build" rejection the project has already hit — keep the watch off the
listing until it does something.
