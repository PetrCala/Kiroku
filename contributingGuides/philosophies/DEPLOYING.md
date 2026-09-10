# Deploying Philosophy

This guide describes the intended Kiroku release cycle and how to operate it once the workflow refactor is complete. It is adapted from Expensify's deploy philosophy, but simplified for Kiroku's iOS and Android beta release process.

## Terminology

- **`master`** - Source branch for merged application changes.
- **`staging`** - Release-candidate branch. A push to this branch deploys to closed/internal beta environments.
- **`production`** - Approved release branch. A push to this branch submits iOS for App Store review and starts a 20% staged rollout on Google Play production.
- **StagingDeployCash** - GitHub issue label for the current staging deploy checklist.
- **DeployBlockerCash** - GitHub issue label for a blocker that prevents promotion from staging to production.
- **LockCashDeploys** - GitHub issue label that freezes staging while QA is in progress.
- **Cherry pick (CP)** - Deploying a specific already-merged PR directly to `staging` or `production`.

## Release Environments

Kiroku uses the same branch-promotion idea as Expensify:

```text
master -> staging -> production
```

For Kiroku, the environments mean:

- `master`: code has merged, but it is not necessarily in a tester-facing build yet.
- `staging`: iOS TestFlight internal testing and Android closed beta.
- `production`: the App Store (submitted for review) and Google Play production (a 20% staged rollout, ramped by hand). Play's open-testing track no longer gets new builds; its testers receive the production build once it's newer than what they have.

GitHub Releases are release records and artifact holders. Branch pushes own deployment.

## Core Rules

### All code must go to staging before production

New code is first deployed to the closed/internal beta environments from `staging`. It is promoted to `production` only after the staging deploy checklist is approved.

### Pull requests should deploy to staging automatically

When a PR is merged to `master`, CI runs. If CI passes and staging is not locked, the release workflow bumps the build version, promotes `master -> staging`, and deploys to the internal/closed beta environments.

If staging is locked, the PR remains on `master` and is deferred until the next staging cycle.

### StagingDeployCash tracks the release candidate

Every staging release candidate is represented by one open GitHub issue labeled `StagingDeployCash`:

https://github.com/PetrCala/Kiroku/issues?q=is%3Aopen+is%3Aissue+label%3AStagingDeployCash

The checklist issue should contain:

- release version
- `production...staging` compare link
- PRs included in the release
- deploy blockers
- smoke-test checks for iOS internal testing and Android closed beta
- crash/status checks
- final approval through a `:shipit:` comment

### Lock staging while validating a candidate

Add the `🔐 LockCashDeploys 🔐` label to the open `StagingDeployCash` issue when you want to freeze the current staging candidate.

While locked, new PRs can still merge to `master`, but they will not automatically deploy to `staging`. They will be picked up after the current release cycle finishes.

### Deploy blockers prevent production promotion

If staging has a severe issue that is not present in production/open beta, create or identify the issue and add the `DeployBlockerCash` label.

Deploy blockers are added to the open staging checklist. Production promotion should not proceed until blockers are resolved or explicitly checked off.

### Production/open beta is triggered by closing StagingDeployCash

When the staging candidate is ready:

1. Check all required checklist boxes.
2. Add a final comment starting with `:shipit:`.
3. Close the `StagingDeployCash` issue.

Closing a valid checklist promotes `staging -> production`, which triggers the open beta / future production deploy. The release workflow then creates a new patch version on `master` and starts the next staging cycle.

### Versioning follows Expensify's model

- Normal staging deploy: bump `BUILD`, for example `0.3.11-2 -> 0.3.11-3`.
- After production/open-beta promotion: bump `PATCH`, for example `0.3.11-3 -> 0.3.12-0`.
- Cherry-pick to staging: bump `BUILD`.
- Cherry-pick to production: bump `PATCH`.

## Day-To-Day Release Flow

### I want an internal iOS or closed Android build

Merge a PR to `master`.

If checks pass and staging is unlocked, the workflows should automatically:

1. bump the build version
2. promote `master -> staging`
3. deploy iOS to TestFlight internal testing
4. deploy Android to closed beta
5. create or update the `StagingDeployCash` issue

### I want to freeze the current staging candidate

Open the current `StagingDeployCash` issue and add:

```text
🔐 LockCashDeploys 🔐
```

The lock workflow waits for active staging deploys to finish, then comments that internal QA can begin.

### I found a blocker on staging

Create or reuse a GitHub issue, label it:

```text
DeployBlockerCash
```

The deploy checklist should be updated with the blocker. Do not close the checklist until the blocker is resolved or explicitly accepted.

### I want to promote to open beta / production

Use the open `StagingDeployCash` issue:

1. Verify iOS and Android builds.
2. Check all PRs, blockers, and verification boxes.
3. Add a final `:shipit:` comment.
4. Close the issue.

If validation passes, the workflows promote `staging -> production`.

### I need a hotfix or cherry-pick

Trigger the [cherryPick workflow](../../.github/workflows/cherryPick.yml) manually from the GitHub Actions UI:

1. Go to **Actions → Cherry-pick a pull request → Run workflow**.
2. Paste the full URL of the already-merged PR.
3. Choose `staging` or `production` as the target.

The workflow bumps the version, cherry-picks the PR, and pushes the target branch, which triggers the normal branch-driven deploy. If there are conflicts, it opens a conflict-resolution PR instead and notifies Discord.

For a **production** cherry-pick, the workflow also automatically bumps staging to the next patch version afterwards, so staging stays ahead of the App Store / Play Store version.

### I want to ship Android to Play production on its own

`:shipit:` ships Android through `fastlane android production`, which promotes the internal build to Play production as a 20% staged rollout. `scripts/play.mjs promote` covers the rest: shipping Android without `:shipit:` (while iOS is in review, say), attaching release notes, and ramping or completing a rollout. To ship straight from the internal track:

```bash
node scripts/play.mjs promote --version-code 1001000008
```

#### Why `:shipit:` has to wait while iOS is in review

Closing the `StagingDeployCash` issue with `:shipit:` pushes `production`, and the same deploy runs `fastlane ios production`. That lane calls `deliver` with a newer build number and `reject_if_possible: true`, which **pulls back any iOS version that's waiting for or in App Review** and resubmits. Review then starts again from scratch.

So while an iOS version is in review (for example one submitted by hand with `node scripts/asc.mjs submit`), don't close the checklist. Ship Android with the steps below, and resume the normal `:shipit:` cycle once iOS is approved. Check the iOS state with `node scripts/asc.mjs status`.

#### Steps

1. **See what's on internal.** `node scripts/play.mjs status` prints every track with its version codes decoded (`1001000008 = 1.0.0-8`). Pick the code on internal that you want to ship. A later staging deploy replaces the internal release, so either ship before the next one or add `🔐 LockCashDeploys 🔐` to hold staging while you do.
2. **Write the release notes.** Put one file per Play language in `fastlane/play-release-notes/<MAJOR.MINOR.PATCH>/` (`en-US.txt`, `cs-CZ.txt`), each 500 characters at most. The `release-notes` skill drafts them against the last Play production (or open-testing) release. `promote` picks this folder up by version; `--notes-dir <dir>` overrides it.
3. **Dry run.** `node scripts/play.mjs promote --version-code <code>` (the code, `1001000008`, or the version it decodes to, `1.0.0-8`) opens an edit, sets the production release, has Play validate it, prints what the track would hold, and throws the edit away. It checks that the code is on internal and fails on notes over the limit.
4. **Ship.** Run the same command with `--yes` to commit the edit. For a staged rollout, add `--rollout 0.2` (20% of users); run it again with a higher fraction, or without `--rollout` for everyone.
5. **Publish if Managed publishing is on.** Committed changes go to Google review, and with Managed publishing on they're held after review until you click publish in Play Console under **Publishing overview**. A first production release can take several days to review.

#### Ramping a staged rollout

A `:shipit:` release starts at 20% and carries no release notes, because the lane skips changelogs. `promote` also accepts a code that's already rolling out on the target track, even after a staging deploy has replaced internal:

```bash
# attach notes from fastlane/play-release-notes/<version>/ and stay at 20%
node scripts/play.mjs promote --version-code 1.0.0-9 --rollout 0.2 --yes
# widen to half of users
node scripts/play.mjs promote --version-code 1.0.0-9 --rollout 0.5 --yes
# complete the rollout
node scripts/play.mjs promote --version-code 1.0.0-9 --yes
```

A ramp keeps the notes already on the release unless that version's notes folder exists. Drop `--yes` for a dry run first. With Managed publishing on, each committed change waits under **Publishing overview** until you publish it.

The script decrypts the fastlane service-account key in memory and prompts for `LARGE_SECRET_PASSPHRASE` (hidden input) when it isn't set, so there's nothing to export beforehand.

## Key GitHub Workflows

### preDeploy

Runs after code is pushed to `master`.

Expected responsibilities:

- run CI gates
- check whether staging is locked
- create a new `BUILD` version when deployable
- promote `master -> staging`
- comment on deferred PRs when staging is locked

### createNewVersion

Creates the next app version and updates native version files.

Expected inputs:

- `BUILD`
- `PATCH`
- `MINOR`
- `MAJOR`

Normal release cycles mostly use `BUILD` and `PATCH`.

### updateProtectedBranch

Reusable branch-promotion workflow.

Expected behavior:

- `TARGET_BRANCH=staging`: force-update `staging` from `master`
- `TARGET_BRANCH=production`: force-update `production` from `staging`

### deploy

Runs on pushes to `staging` or `production`.

Expected staging behavior:

- build/upload iOS to TestFlight internal testing
- build/upload Android to closed beta
- create or update the staging GitHub prerelease/artifacts
- create or update the deploy checklist

Expected production behavior:

- submit the iOS build (already on TestFlight from staging) for App Store review
- promote Android from internal to Play production as a 20% staged rollout
- create or update the production GitHub release/artifacts

### createDeployChecklist

Creates or updates the `StagingDeployCash` issue for the current staging release candidate.

If a checklist is open, it updates that checklist and preserves checked state. If the latest checklist is closed, it creates a new one.

### lockDeploys

Runs when the `🔐 LockCashDeploys 🔐` label is added to the open `StagingDeployCash` issue.

Expected behavior:

- wait for active staging deploys to finish
- comment that internal QA can begin
- keep staging frozen until the issue is unlocked or completed

### finishReleaseCycle

Runs when a `StagingDeployCash` issue is closed.

Expected behavior:

- validate deployer permission
- require all checkboxes to be checked
- require the final `:shipit:` comment
- reopen the issue if validation fails
- promote `staging -> production` if validation succeeds
- create a new `PATCH` version and start the next staging cycle

### cherryPick

Manual `workflow_dispatch` for deploying a specific already-merged PR directly to `staging` or `production`, bypassing the normal release cycle.

**Inputs:**

| Input              | Required | Description                                     |
| ------------------ | -------- | ----------------------------------------------- |
| `PULL_REQUEST_URL` | Yes      | Full URL of the merged Kiroku PR to cherry-pick |
| `TARGET`           | Yes      | `staging` or `production`                       |

**What it does:**

1. Validates the actor has write/admin access and the PR is merged into `PetrCala/Kiroku`.
2. Creates a new version via `createNewVersion`:
   - `TARGET=staging` → `BUILD` bump (e.g. `0.3.11-5 → 0.3.11-6`)
   - `TARGET=production` → `PATCH` bump (e.g. `0.3.11-6 → 0.3.12-0`)
3. Cherry-picks the version bump commit and the PR's merge commit onto the target branch.
4. Pushes the target branch, triggering the normal `deploy` workflow.
5. Labels the original PR `CP Staging` or `CP Production`.
6. Notifies Discord on success, conflict, or failure.

**Conflict handling:** if the cherry-pick cannot be applied cleanly, the workflow creates a conflict-resolution branch and opens a PR against the target branch with step-by-step manual resolution instructions. Discord is notified with a link to the conflict PR.

**Post-production staging sync:** after a successful production cherry-pick, the workflow automatically performs a second `PATCH` bump on `master` and cherry-picks it to `staging`. This keeps staging's version strictly higher than production, which is required to submit new builds to the App Store and Play Store.

### testBuild

Builds ad-hoc PR apps for manual testing before merge. This is separate from the release cycle.

## Local Production Builds

Sometimes it is useful to create a local production build instead of waiting for a pipeline run.

### iOS

```bash
npm run ios-build
```

This creates a `kiroku.ipa` in the repository root.

### Android

```bash
npm run android-build
```

This creates an Android build artifact under `android/app`.
