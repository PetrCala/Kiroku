# Apple Watch — Phase 0 spike

Proves the watchOS **data path** before any Xcode/Swift work: it posts a live
drinking session to kiroku-api exactly as the future watch client will, then
deletes it. If this round-trips, the request envelope, push-id format, and
server acceptance are all validated — the only remaining unknown for the watch is
plumbing (target wiring + the credential bridge), not the contract.

This script is the **executable spec** of the contract Phase 2 reimplements in
Swift. See [`docs/apple-watch-mvp.md`](../../docs/apple-watch-mvp.md) for the full
scope.

## Run it

Requires Node 18+ (global `fetch`). No dependencies.

```bash
# Dev (default): create a 2-unit live session, then delete it.
node scripts/watch-spike/post-session.mjs --token "<FIREBASE_ID_TOKEN>"

# Keep the session so the phone app can display it (manual confirm).
node scripts/watch-spike/post-session.mjs --token "<TOKEN>" --units 3 --keep

# Help.
node scripts/watch-spike/post-session.mjs --help
```

You can also pass the token via the `KIROKU_ID_TOKEN` env var instead of
`--token`. The token is never logged.

## Getting a Firebase ID token (dev account)

The token is a short-lived (~1h) Firebase ID token for a **dev** account. Easiest
ways to grab one:

- **From the running web app** (`npm run web`, dev backend): sign in, then in the
  browser console run
  `await firebase.auth().currentUser.getIdToken()` (or grab the `Authorization:
Bearer …` header off any `api-dev.kiroku.cz` request in the Network tab).
- **From a signed-in simulator/device:** copy the `Authorization` header from any
  outbound kiroku-api request (Charles/Proxyman, or a temporary log in
  `HttpUtils.ts`).

Tokens expire after ~1 hour — if you see a `401`/`407`, grab a fresh one.

## Acceptance (Phase 0)

- `--keep` run returns `2xx` on `/v1/sessions/update`, **and** the session shows
  up in the phone app for the same dev account as a live session.
- Default run reports `✓ Round-trip OK: create + delete both succeeded.`

## What this does NOT prove

- Token **refresh** on the watch (Phase 3) — this uses a hand-grabbed token.
- The WCSession credential handover (Phase 3).
- The Swift port of `generatePushID` / the models (Phase 2) — this is the JS
  reference they must match.
