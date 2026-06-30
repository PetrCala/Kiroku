# KirokuWatchCore

The pure-Swift (no Firebase SDK) **networking + model layer** for the Kiroku
Apple Watch companion — Apple Watch MVP **Phase 2**
([`docs/apple-watch-mvp.md`](../../docs/apple-watch-mvp.md)).

It is the Swift reimplementation of the executable contract proven by the Phase 0
spike ([`scripts/watch-spike/post-session.mjs`](../../scripts/watch-spike/post-session.mjs)):
mint a Firebase-compatible session id, build a live `DrinkingSession`, and post
it to kiroku-api with a `Bearer` token — then delete it.

## What's here

| File | Mirrors | Purpose |
| --- | --- | --- |
| `Sources/KirokuWatchCore/DrinkingSession.swift` | `src/types/onyx/DrinkingSession.ts`, `src/types/onyx/Drinks.ts` | Codable session + `DrinkKey`/`SessionType`; `start_time`/`end_time` map to snake_case on the wire; `drinks` = `[Timestamp: [DrinkKey: Int]]`. |
| `Sources/KirokuWatchCore/PushID.swift` | `src/libs/generatePushID.ts` | 20-char, time-sortable Firebase push-id generator (8 timestamp chars + 72 random bits, same-ms carry). |
| `Sources/KirokuWatchCore/KirokuAPI.swift` | `src/libs/HttpUtils.ts`, `src/libs/API/kirokuRoutes.ts`, `src/CONFIG.ts` | `URLSession` JSON client: `Bearer` auth, dev/prod base URL, `start`/`update`/`save`/`discard`, typed 407/401/network/server errors. |

No Firebase SDK, no `WCSession` — the auth token is injected by a caller-provided
closure so the Phase 3 credential bridge plugs in without this layer knowing
anything about WatchConnectivity. The only frameworks used are Foundation and
Security, so the same sources compile on watchOS, iOS, and the macOS test host.

## Why a standalone SwiftPM package

The watchOS Xcode target is currently orphaned and gets rebuilt in Phase 1, so
these files are packaged as a library that:

- builds and unit-tests **today** via `swift test` on the macOS host, and
- drops into the `kiroku` watch target in Phase 1 — either added as a local
  package dependency, or by adding `Sources/KirokuWatchCore/*.swift` to the
  target directly.

## Operations (the contract)

- `start(session)` / `update(session)` / `save(session)` →
  `POST /v1/sessions/update`, body `{ sessionId, session, sessionIsLive: true }`.
  They share one wire contract; drinks are part of the session object (there is
  no per-drink endpoint). `save` should pass a session with `ongoing == false`.
- `discard(sessionId:)` → `POST /v1/sessions/delete`, body
  `{ sessionId, sessionIsLive: true }`.

Auth mapping (from `HttpUtils.ts`): `407 → .tokenExpired` (refresh), `401 →
.tokenRevoked` (re-auth); transport failures → `.network`; other non-2xx →
`.server`.

## Tests

```bash
# Offline suite (models, push-id, error mapping) — no network, no token:
swift test --package-path ios/KirokuWatchCore

# Live acceptance round-trip — create + delete against api-dev with a dev token:
KIROKU_ID_TOKEN="<dev firebase id token>" \
  swift test --package-path ios/KirokuWatchCore --filter KirokuAPIRoundTripTests
```

The round-trip test **skips cleanly** when `KIROKU_ID_TOKEN` is unset. Grab a dev
token the way the spike's [README](../../scripts/watch-spike/README.md) describes
(it expires after ~1h). Optional env: `KIROKU_API_ENV=dev|prod` (default `dev`),
`KIROKU_UNITS` (default `2`).
