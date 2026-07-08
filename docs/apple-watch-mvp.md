# Apple Watch app — MVP scope & task list

> Status: **planning / Phase 0 spike in progress.** This doc is the canonical
> reference for the watchOS companion effort. Each phase below is spun off into
> its own session/worktree; this doc is the shared contract between them.

## Verdict

Feasible, and the backend side is **easier now than when the watch was first
scaffolded** — the client long since migrated off direct Firebase RTDB writes to
a clean kiroku-api REST contract. The existing watch code
([`ios/Kiroku Watch App/`](../ios/Kiroku%20Watch%20App/)) is a **UI mock-up
disconnected from everything** (in-memory `SessionModel`, every Firebase/Auth
line commented out, no WatchConnectivity, orphaned from the build). Realistic
shape: **keep the SwiftUI views as a visual starting point, rebuild the target
wiring from scratch, and add a small native networking + credential-bridge
layer.**

T-shirt size: **M** for a "remote control while the phone is nearby" MVP; **L**
for a phone-free standalone logger (adds backend token-minting + on-watch
Firebase).

## What exists today (audit)

- ~674 lines of SwiftUI: start-session, unit selection (beer/wine/cocktail/shot/
  other), session control (save/discard), settings, EN+CZ translations, icons.
- **No state, no network, no persistence.** `SessionModel` is an in-memory
  counter; `SessionViewModel` has a literal `// communication with database
here` TODO. All Firebase/Auth/Database/AppDelegate code is commented out.
- **No WatchConnectivity (WCSession)** on either side.
- **Not in the Podfile** → the watch target has no Firebase SDK.
- **Orphaned from the build.** The real iOS app target is `kiroku` (lowercase);
  all three schemes build only `kiroku` + `kirokuTests`. The watch app is
  embedded solely in a legacy capital-`Kiroku` `watchapp2-container` wrapper that
  no scheme builds. It has **never shipped** — no review liability, but reviving
  it means re-wiring into `kiroku` essentially from scratch.
- Bundle id is still the RN template default
  (`org.reactjs.native.example.alcohol-tracker.watch`); the watch provisioning
  profiles in `ios/` are 2–3 years old → expired.

## Confirmed API contract (what the watch must replicate)

The current data path, verified against `src/libs/`:

- **Endpoints:** `POST /v1/sessions/update` (start / add units / save) and
  `POST /v1/sessions/delete` (discard). Defined in
  [`src/libs/API/kirokuRoutes.ts`](../src/libs/API/kirokuRoutes.ts).
- **Auth:** a **Firebase ID token** as `Authorization: Bearer <token>` on every
  call ([`src/libs/HttpUtils.ts`](../src/libs/HttpUtils.ts)). Auto-refresh on
  `407`, forced sign-out on `401`.
- **Base URL:** `https://api.kiroku.cz` (prod) / `https://api-dev.kiroku.cz`
  (dev) — [`src/CONFIG.ts`](../src/CONFIG.ts).
- **Request body:** plain JSON, `Content-Type: application/json`. For a session
  write the body is literally `{ sessionId, session, sessionIsLive }`; discard is
  `{ sessionId, sessionIsLive }`.
- **Session id:** `generatePushID()` — Firebase push-id (20 chars, timestamp-
  prefixed, lexicographically sortable). Algorithm in
  [`src/libs/generatePushID.ts`](../src/libs/generatePushID.ts); a ~40-line Swift
  port gives the watch compatible ids.
- **Session shape**
  ([`src/types/onyx/DrinkingSession.ts`](../src/types/onyx/DrinkingSession.ts) /
  `getEmptySession` in
  [`src/libs/DrinkingSessionUtils.ts`](../src/libs/DrinkingSessionUtils.ts)):
  `id`, `start_time`, `end_time`, `blackout`, `note`, `timezone`, `type`
  (`'live'`), `ongoing` (`true`), and `drinks` =
  `Record<Timestamp, Record<DrinkKey, number>>` (drink keys: `small_beer`,
  `beer`, `cocktail`, `wine`, `strong_shot`, `weak_shot`, `other`).
- **Firebase is auth-only.** No RTDB on the session write path.

A runnable, documented reproduction of this exact contract lives in
[`scripts/watch-spike/`](../scripts/watch-spike/) (Phase 0).

## MVP definition

A wrist remote that talks to the real kiroku-api: **start a live session →
+1 / −1 a unit → save or discard**, posting directly to the API. The auth token
is handed over from the signed-in phone via WatchConnectivity. It works whenever
the phone has been recently active and **degrades gracefully** ("Open Kiroku on
your phone") when the token is stale.

**Big simplification:** because the MVP gets its token from the phone, the watch
never signs in itself → **no Firebase SDK, no Podfile change, no
GoogleService-Info on the watch.** It is a pure `URLSession` + `WCSession` app.

### Architecture decision

The watch is an **independent API client** (talks to kiroku-api directly over its
own network); WCSession is used only to hand the credential + the current
ongoing-session snapshot from phone to watch. This avoids the React Native
background-execution trap (a relay model would require running JS in the
background to perform writes, which iOS does not reliably allow).

### Explicitly NOT in this MVP

Each is a real follow-on, deliberately deferred:

- Backend custom-token endpoint / true cellular-standalone use.
- On-watch offline queue.
- **Real-time** cross-device live-unit streaming — the phone reflects the watch's
  session on its next session read (eventual consistency). This matches the known
  unsolved increment (#947).
- Complications / widgets.
- Drink-type richness beyond the single default unit.

## Task list

Each phase is an independently spawnable unit (its own worktree/session). The
critical path is **0 → 1 → 2 → 3**; Phases 5–7 overlap once the bridge works.

### Phase 0 — Spike: prove the data path (½–1 day) ← in progress

- [ ] **0.1** From [`scripts/watch-spike/post-session.mjs`](../scripts/watch-spike/post-session.mjs),
      with a dev account's Firebase ID token, `POST /v1/sessions/update`
      (`sessionIsLive: true`) to `api-dev`, then `/v1/sessions/delete`.
  - **Accept:** the session shows up in the phone app (dev account) and discard
    removes it. Validates envelope + push-id format + server acceptance before
    any Xcode work.

### Phase 1 — Target & build wiring (1–2 days)

- [ ] **1.1** Delete the dead wiring: the orphaned capital-`Kiroku`
      `watchapp2-container` target, its "Embed Watch Content" phase, and the stale
      `KirokuWatch*.mobileprovision.gpg` profiles.
- [ ] **1.2** Add a fresh modern watchOS App target embedded in `kiroku`. Import
      the existing `.swift` files as source. Real bundle id
      (`org.reactjs.native.example.alcohol-tracker.watchkitapp`),
      `WKCompanionAppBundleIdentifier` → the app, watchOS deploy target 10.2+.
- [ ] **1.3** Add the watch to all three schemes (dev/AdHoc/production) so it
      archives with the app.
  - **Accept:** the watch app builds + runs in the simulator paired with `kiroku`;
    a production-scheme archive embeds it.

### Phase 2 — Watch networking + models, pure Swift (2–3 days)

- [ ] **2.1** Codable models mirroring `DrinkingSession`
      (`drinks` = `[Timestamp: [DrinkKey: Int]]`).
- [ ] **2.2** PushID generator — port `generatePushID()` to Swift.
- [ ] **2.3** `KirokuAPI` client: `URLSession` JSON POST, `Bearer` header,
      dev/prod base URL, map 407/401/network to typed results.
- [ ] **2.4** Operations: `start`, `update` (whole-session PUT), `save`,
      `discard`, hitting the two endpoints.
  - **Accept:** a unit test round-trips a session against `api-dev` with a pasted
    token.

### Phase 3 — Credential bridge (3–4 days — the meatiest piece) ← done

- [x] **3.1** RN iOS native module `WatchBridge` exposing
      `updateCredential({ idToken, uid, expiresAt, ongoingSession })` to JS; holds the
      latest and pushes to the watch via `WCSession.updateApplicationContext`.
      Implemented in [`ios/kiroku/WatchBridge.swift`](../ios/kiroku/WatchBridge.swift)
      (legacy `RCT_EXTERN_MODULE`; payload also carries `apiEnv` so the watch
      hits the same backend as the phone).
- [x] **3.2** JS wiring ([`src/libs/WatchBridge/`](../src/libs/WatchBridge/)):
      one `auth.onIdTokenChanged` listener covers login, sign-out, and the 407
      forced refresh (Reauthentication middleware's `getIdToken(true)` fires
      it), plus `AppStateMonitor` foreground + `ONGOING_SESSION_DATA` Onyx
      triggers, throttled and deduped. Initialized from `src/setup/index.ts`.
- [x] **3.3** Watch `SessionConnectivity` (`WCSession` delegate): receives
      credential + ongoing snapshot, caches the token in the Keychain
      (`CredentialStore`), exposes it + staleness to the view model
      ([`ios/Kiroku Watch App/Connectivity/`](../ios/Kiroku%20Watch%20App/Connectivity/)).
- [x] **3.4** Token lifecycle: the cached token is used until
      `expiresAt` (60s safety margin) or a server 401/407; when stale, the
      watch shows "Open Kiroku on your phone to reconnect."
  - **Accept:** sign in on phone → watch receives a token within seconds → a
    watch-initiated start/save succeeds with no token pasted anywhere.
  - **Limitation (by design):** iOS never runs the RN JS bridge in the
    background, so tokens are refreshed/pushed only while the phone app is
    alive (foreground, or briefly while backgrounding). The watch caches the
    last token in its Keychain and uses it until `expiresAt` (~1h); past that
    it degrades to the reconnect message until the phone app is opened again.
    `updateApplicationContext` is last-value-wins and delivered even while the
    watch app is dead, and `WCSession` persists the last received context, so
    a cold-started watch always sees the newest credential the phone ever sent.

### Phase 4 — Wire the UI to a real view model (1–2 days)

- [ ] **4.1** Replace the in-memory `SessionModel`/`SessionViewModel` with one
      backed by `KirokuAPI` + `SessionConnectivity`; reflect the ongoing session
      pushed from the phone.
- [ ] **4.2** Loading / no-active-session / disconnected states, haptic on tap,
      inline error on failed write.
  - **Accept:** full happy path on a real paired device: start → +1 ×3 → save, all
    visible in the phone app after sync; discard path too.

### Phase 5 — Sync & conflict handling (1–2 days)

- [ ] **5.1** Adopt the phone's ongoing session id when one is active (log into
      the _same_ session, no duplicate); only mint a new id when nothing is active.
- [ ] **5.2** Coalesce taps — debounce rapid +/− into one `update` (mirror the
      app's ~500ms persist); last-writer-wins on the whole-session PUT.
- [ ] **5.3** Save/discard clears live status server-side; confirm the phone
      reflects it on next session read.
  - **Accept:** starting on phone then bumping on watch updates one session, not
    two; rapid taps don't spam the API.

### Phase 6 — Signing, CI, store plumbing (1–2 days)

- [ ] **6.1** Register the watch App ID + provisioning profiles (use the
      `ios-signing` skill); re-encrypt into `ios/`. No GoogleService-Info / Firebase
      pod needed (token comes from the phone).
- [ ] **6.2** Fastlane: sign + embed the watch in the dev/adhoc/prod lanes;
      green test build.
- [ ] **6.3** Store metadata: watch screenshots + App Store watch listing fields.

### Phase 7 — QA matrix (1 day)

- [ ] **7.1** Cross-product: phone foreground / background / force-quit; watch in
      BT range vs not; token fresh vs stale/expired; each of start/+/−/save/discard;
      airplane mode on the watch.
  - **Accept:** every cell is correct or shows the right graceful-degradation
    message — no silent data loss.

## Sizing & risks

- **Walking skeleton** (Phases 0–4 happy path): ~3–5 focused days.
- **Polished, signed, store-ready MVP:** ~2–3 weeks of solo work.
- **Critical path:** 0 → 1 → 2 → 3.
- **Top risks:** the credential bridge (Phase 3) is the only genuinely new
  pattern; real-time phone reflection is deliberately deferred (#947).
- **Recommendation:** keep off the launch critical path; land as a fast-follow.
