---
name: asc
description: Inspect App Store Connect state, lint the iOS store listing, and submit an app version for review for Kiroku via the zero-dependency scripts/asc.mjs CLI (App Store Connect API). Use whenever the user wants to check App Store / ASC status (version, build, subscription states, review submissions), submit or resubmit the iOS build for review, verify the store listing before submitting, confirm subscriptions are parked, or work through an App Store rejection. Trigger on phrasing like "submit the build", "what's my App Store status", "is the build ready to submit", "check ASC", "resubmit to App Review", "scrub the store listing", "did the subscriptions get attached", "why was the app rejected". Encodes the gotchas of Apple's review-submission model.
---

# App Store Connect helper (Kiroku)

Drives [`scripts/asc.mjs`](../../../scripts/asc.mjs) — a zero-dependency Node CLI
over the App Store Connect API. It reuses the existing fastlane API key at
`ios/ios-fastlane-json-key.json` (key_id / issuer_id / .p8) and mints the ES256
JWT itself with Node's built-in `crypto`. It never prints the key. Requires Node 18+.

## Commands

```bash
node scripts/asc.mjs status                              # app, versions + states, build, subscriptions, review submissions
node scripts/asc.mjs scrub  [--version X] [--terms a,b]  # lint store listing for forbidden terms; exit 1 on any hit (CI-friendly)
node scripts/asc.mjs submit [--version X] [--yes]        # dry run unless --yes; submits the version for review, app-only (no IAPs)
```

Run from the repo root. Useful flags: `--version` (defaults to the lone
`PREPARE_FOR_SUBMISSION` version), `--app-id` (skips the bundle-id lookup),
`--key <path>` or `ASC_KEY_JSON` (if the key lives outside the repo, e.g. when
working from a git worktree where the gitignored key isn't present), `--terms`
(override the scrub word list). `node scripts/asc.mjs --help` for the rest.

## How to ship an iOS version (playbook)

1. **`status`** — confirm the target version is `PREPARE_FOR_SUBMISSION` and its
   build is `processingState=VALID`.
2. **`scrub --version X`** — the store description/keywords must not mention
   anything that isn't actually in this build. Until the paid tier ships that
   means no "supporter / subscription / předplatné / podporovatel". A listing
   that describes absent features is its own rejection (Guideline 2.3).
3. Ensure subscriptions are **parked** (`DEVELOPER_ACTION_NEEDED`, i.e. not
   `WAITING_FOR_REVIEW` / `IN_REVIEW`) when shipping without them.
4. Fix the **App Privacy / App Tracking Transparency** label in the ASC UI — that
   is not scriptable here and is a common rejection (Guideline 5.1.2(i)).
5. **`submit --version X`** (dry run) to see the pre-flight, then add `--yes` to
   fire. `submit` refuses if the version isn't submittable, the build isn't VALID,
   a subscription is in review, or the listing scrub finds a hit.

## App Store Connect gotchas (hard-won)

- **Submissions are per-version `reviewSubmissions`.** A version is submitted by
  creating a reviewSubmission, adding the appStoreVersion as its item, then
  PATCHing `submitted=true`. `submit` does exactly that.
- **IAPs/subscriptions are NOT reviewSubmission items** — Apple reviews them in a
  separate flow. So submitting a version cannot drag a subscription along; you
  only need the subscriptions _parked_. Conversely, the **first** subscription
  must be submitted _with_ an app version (but a version may ship with none).
- **In a rejected / "unresolved issues" state, the version page's "In-App
  Purchases and Subscriptions" section disappears** and you can't add items.
  Manage it from the App Review submission, or just cut a fresh version and
  submit that app-only (what we did for 0.3.14).
- **`submit` is irreversible** — hence `--yes` is required; always dry-run first.

## Safety

- Never print or commit the API key (`ios/ios-fastlane-json-key.json` is
  gitignored). The script reads it by path and only ever sends signed JWTs.
- Changing live store copy (descriptions) is intentionally **not** a CLI command
  — do that deliberately in the ASC UI, or via a one-off reviewed PATCH, so
  marketing text is never altered by accident.
