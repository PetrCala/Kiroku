---
name: ios-signing
description: Diagnose and fix expired iOS code-signing assets for Kiroku via the zero-dependency scripts/ios-signing.mjs CLI (App Store Connect API). Use whenever the staging/production or test-build deploy fails on the iOS "Run Fastlane" step with signing errors ("No certificate for team ... matching 'Apple Distribution'", "Provisioning profile 'Kiroku' expired", "Code Signing Error"), or whenever the user wants to renew/regenerate the iOS distribution certificate or the Kiroku / Kiroku_AdHoc provisioning profiles, check how soon they expire, or re-encrypt the committed ios/*.gpg signing assets. Trigger on phrasing like "the iOS deploy is failing on signing", "the provisioning profile expired", "renew the certificates", "regenerate the signing assets", "are the iOS certs about to expire".
---

# iOS code-signing renewal (Kiroku)

Drives [`scripts/ios-signing.mjs`](../../../scripts/ios-signing.mjs) — a
zero-dependency Node CLI over the App Store Connect API. Kiroku uses **manual
iOS signing** (not fastlane `match`): GPG-AES256-encrypted assets committed in
`ios/` and decrypted in CI with the `LARGE_SECRET_PASSPHRASE` secret. The Apple
Distribution certificate and the `Kiroku` (App Store) / `Kiroku_AdHoc` (ad-hoc)
provisioning profiles expire ~yearly; when they do, **every iOS build breaks**
until they're regenerated and re-committed.

This tool reuses the existing fastlane API key (`ios/ios-fastlane-json-key.json`,
or its `.gpg`) and mints the ES256 JWT itself — the same way
[`scripts/asc.mjs`](../../../scripts/asc.mjs) does. It never prints the API key,
the GPG passphrase, or the new P12 password.

## Commands

```bash
node scripts/ios-signing.mjs check  [--deep] [--days 21]   # report expiry/state; exit 1 if expired/expiring
node scripts/ios-signing.mjs renew  [--yes]                # mint cert + profiles, re-encrypt, open PR (dry run unless --yes)
node scripts/ios-signing.mjs finalize [--yes]              # POST-MERGE: rotate the secret + revoke old cert
```

Run from the repo root. Requires Node 18+, **OpenSSL 3.x** (`brew install
openssl@3`), `gpg`, and — for the P12 verify + `finalize` — macOS `security`
and an authenticated `gh`. The GPG passphrase comes from `LARGE_SECRET_PASSPHRASE`
(or `--passphrase`); it's needed to decrypt the API key from its `.gpg` and to
re-encrypt the regenerated assets.

## The playbook (when a deploy fails on signing)

1. **Confirm the cause.** `node scripts/ios-signing.mjs check --deep`. `--deep`
   decrypts the committed `ios/*.gpg` and reports the **embedded** cert expiry —
   the true CI signing constraint. A profile whose embedded distribution cert is
   expired fails the build even if the portal looks fine.
2. **Dry-run the fix.** `node scripts/ios-signing.mjs renew` prints the full plan
   (cert type, device count, which profiles get replaced) and executes nothing.
3. **Execute.** `node scripts/ios-signing.mjs renew --yes` mints a new Apple
   Distribution cert, rebuilds `Certificates.p12`, regenerates `Kiroku` +
   `Kiroku_AdHoc` (same names — the Fastfile binds profiles by name), re-encrypts
   the three `ios/*.gpg`, commits on a new branch, and opens a PR to `master`
   (reviewer `KirokuAdmin`). It does **not** rotate the secret or revoke anything.
4. **Merge the PR.**
5. **Finalize.** `node scripts/ios-signing.mjs finalize --yes` rotates
   `IOS_CERTIFICATE_PASSWORD` to the new P12 password and revokes the old expired
   cert / deletes the old profiles. **Only after merge** — see the split rationale
   below.
6. **Re-run the deploy** and confirm the iOS "Run Fastlane" step archives + signs.

## Why renew and finalize are split

The committed P12 and the `IOS_CERTIFICATE_PASSWORD` secret must match. If
`renew` rotated the secret immediately, there'd be a window where the live secret
matches a P12 that isn't on `master` yet, breaking any `master` deploy in between
— harmless during an active outage, but a real regression if you ever run this
_proactively_ before expiry (the eventual webhook goal). So `renew` is additive
and reversible (you can delete the branch); `finalize` does the irreversible
secret rotation + revocation, after the matching P12 is merged.

## Gotchas (hard-won)

- **OpenSSL 3.x is mandatory for the P12.** The default macOS `openssl` is
  LibreSSL, whose legacy P12 cipher can trip `security import` (the exact call
  fastlane's `import_certificate` runs in CI). The tool resolves
  `/opt/homebrew/opt/openssl@3/bin/openssl` (or `OPENSSL3_BIN`) and verifies the
  P12 locally with `security import` before committing.
- **The API key may need the Admin role.** Creating certificates via the ASC API
  requires the key to be **Admin**, not just App Manager. If `renew --yes` stops
  with a 403, either elevate the key in ASC → Users and Access → Integrations, or
  use the bring-your-own-cert path: `renew --yes --p12 <path> --p12-password <pw>`
  (create the cert/P12 in Xcode or the Developer Portal, the tool does the rest).
- **Profiles are bound by name.** `Kiroku` / `Kiroku_AdHoc` must keep their exact
  names — the Fastfile `export_options` maps the bundle id to those names.
- **The scratch state file** (`ios/.signing-renew-state.json`, gitignored) holds
  the in-flight private key + new P12 password so `finalize` can apply them and a
  re-run can resume instead of minting a duplicate cert. It's cleared on
  `finalize`. Don't commit it; don't print it.
- **Old cert is revoked only if expired.** The tool never auto-revokes a _valid_
  distribution cert — if the 2-cert cap blocks creation and no expired slot
  exists, it stops and asks.

## Out of scope

- `Kiroku_Development` and the `KirokuWatch*` profiles — not consumed by any CI
  scheme, and dev needs a separate Apple Development cert. Renew those manually if
  the dev/watch targets are revived.
- **Never wire this into CI** — it commits and sets secrets; it's a
  local / skill-invoked tool. The eventual `workflow_dispatch` automation is a
  separate, deliberate follow-up.

## End-to-end testing without touching prod assets

`node scripts/ios-signing.mjs renew --yes --profile-suffix .test` creates
`Kiroku.test` / `Kiroku_AdHoc.test` on the account and writes to scratch paths —
it does **not** overwrite `ios/*.gpg` or touch git. Delete the test profiles
manually afterward.
