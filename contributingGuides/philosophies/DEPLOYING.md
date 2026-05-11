# Deploying Philosophy

This guide describes the intended Kiroku release cycle and how to operate it once the workflow refactor is complete. It is adapted from Expensify's deploy philosophy, but simplified for Kiroku's iOS and Android beta release process.

## Terminology

- **`master`** - Source branch for merged application changes.
- **`staging`** - Release-candidate branch. A push to this branch deploys to closed/internal beta environments.
- **`production`** - Approved release branch. A push to this branch deploys to open beta now, and later App Store / Play Store production.
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
- `production`: iOS TestFlight open beta and Android open beta. Later this branch will represent App Store / Play Store production.

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

Use the cherry-pick workflow once it exists. It should accept a merged PR URL and a target branch, either `staging` or `production`.

The workflow should bump the version, cherry-pick the PR, push the target branch, and let the normal branch-driven deploy run.

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

- deploy/promote iOS to TestFlight open beta, later App Store production
- deploy/promote Android to open beta, later Play Store production
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

Manual workflow for deploying specific merged PRs to `staging` or `production`.

Expected behavior:

- validate the PR is merged
- bump the correct version level
- cherry-pick the PR to the target branch
- create a conflict PR if needed
- push the target branch to trigger deploy

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
