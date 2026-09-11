# Sessions v2 (RFC)

Status: **in review; all design questions settled (2026-09-11)**
Last updated: 2026-09-11
Authors: Petr Čala, from the design conversations of 2026-08-28 to 31 and 2026-09-10 to 11
Tracking: epic #1661 (workstreams #1662 to #1671)

This document is the plan for reworking drinking sessions: how drinks are captured, what a session records, how a live session is surfaced, session identity (names, photos), a feed on Home, and **communal shared sessions**. It fixes the data model and write protocol first so every later piece is born compatible with shared sessions, even though shared sessions ship last.

---

## 1. Goals and non-goals

**Goals**

- A session is a precise event log: every drink has its own identity, timestamp, source and optional volume/ABV.
- The live session is the first thing you see while it runs, in the app and on the lock screen.
- Sessions have identity: a name, photos, and an explicit visibility.
- Home gains a feed of sessions below the calendar.
- One shared session that several people log into, with an admin, rounds and drink attribution. This is the feature that sets Kiroku apart.
- Offline keeps working exactly as today: nothing a user logs is ever lost, whether solo or shared.

**Non-goals (for now)**

- Extra capture fields (venue, mood, food/water, price). The model leaves room for them; none ship in v2.
- Kudos or comments on sessions.
- BAC in any form. Grams of ethanol and standard drink units only (App Store rejection #3, Guideline 1.4).
- Plus-gating. Everything in v2 is free; the model must not make gating hard later.
- Rebuilding the sync/offline transport. `SequentialQueue`, the persisted request queue, update-ID gap repair and the debounced live flush encode a year of fixes and stay.

---

## 2. Locked decisions

| #   | Decision                                               | Choice                                                                                                                                                               |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Drink storage                                          | **Entry rows with stable ids** (`entries/{entryId}`), replacing `drinks[timestamp][drinkKey]`. Legacy data is read through an adapter and backfilled.                |
| 2   | Shared sessions                                        | **Communal**: one shared session document with members, an admin, rounds and claims. Not Strava-style linked personal sessions.                                      |
| 3   | Write protocol                                         | **Operations, not snapshots.** Small idempotent ops (`add_entry`, `claim_entry`, ...) applied by the server. Solo sessions move onto it too (§5.6).                  |
| 4   | Per-user data for shared sessions                      | A **server-written projection** per member in `user_drinking_sessions/{uid}/{sessionId}`, so calendar, statistics, the watch and old clients keep working untouched. |
| 5   | Rounds ("add a drink to all")                          | **Auto-accepted**, each person can decline.                                                                                                                          |
| 6   | Unclaimed drinks                                       | **Count toward the session total**, toward nobody's personal stats until claimed. **No claim time limit.**                                                           |
| 7   | Drinks for people who haven't joined yet               | Logged as **unclaimed**. Joining prompts the new member to pick which are theirs. No placeholder members.                                                            |
| 8   | Entries logged offline after the close                 | **Accepted** if their timestamp falls inside the session window plus a grace period, and **flagged as late**. The session doesn't reopen.                            |
| 9   | Member cap                                             | **40**.                                                                                                                                                              |
| 10  | Explicit invites                                       | **Friends only** at first.                                                                                                                                           |
| 11  | Joining by link/QR/code as a non-friend                | **Joining makes you friends with the host**, behind a clear confirmation that spells out what that reveals (§7.3).                                                   |
| 12  | Drinks inside a shared session                         | **Visible to every member** by default, friends or not. Finer hiding can come later.                                                                                 |
| 13  | "Members can invite"                                   | **On** by default; the admin can turn it off.                                                                                                                        |
| 14  | Cold start with a live session                         | **Opens straight into the live session.**                                                                                                                            |
| 15  | Home layout                                            | **Calendar on top, feed below it.** While a session is live, the live card sits above both.                                                                          |
| 16  | Live Activity (iOS) and ongoing notification (Android) | **Ship together.**                                                                                                                                                   |
| 17  | Extra capture fields                                   | **None for v2.**                                                                                                                                                     |
| 18  | Plus-gating                                            | **Nothing gated yet**; may change later.                                                                                                                             |
| 19  | Storage of shared sessions                             | **Promote on share**: a session moves to `shared_sessions` the first time it's shared (§4.1).                                                                        |
| 20  | Grace period for late entries                          | **12 hours** after the close.                                                                                                                                        |
| 21  | Editing and deleting an entry                          | **The author and the target** can edit or delete it; **the admin** can also delete it.                                                                               |
| 22  | Joining while you have your own live session           | **Offer to move your drinks in**, with "keep separate" as the alternative (§7.5).                                                                                    |
| 23  | Account deletion inside shared sessions                | **Entries targeting the deleted user are removed**; entries they logged for others stay, with the author anonymized.                                                 |
| 24  | Sharing a session after it ended                       | **Not in v2.** Join codes exist only while a session is live.                                                                                                        |

---

## 3. Where we start from

Checked against `master` on 2026-09-11 (app `4d5ea8c1`, API `3b1deb18`). Much of what v2 needs already has a foundation.

### 3.1 The session today

- `DrinkingSession` (`src/types/onyx/DrinkingSession.ts`) has `start_time`, `end_time`, `timezone`, `drinks`, `drinksTimeParts`, `blackout`, `note`, `ongoing`, `type`. No name, visibility, photos or schema version. The server's sweep writes `auto_closed`, but the app type doesn't have it.
- Drinks are `DrinksList = Record<DrinksTimestamp, Drinks>`, with `DrinkEntry = number | {count, volume_ml?, abv?}` (`src/types/onyx/Drinks.ts`). The object form exists, but nothing produces it yet (`DrinkingSessionUtils.ts`: "the v2-B UI is the only producer of overrides").
- Live taps key drinks by `Date.now()`, so live data is close to an event log. Sessions edited after the fact collapse onto one synthetic timestamp.
- Removing a drink is a heuristic: `removeDrinksFromList` always takes `'removeFromLatest'`. Drinks have no identity, so the watch keeps its own timestamp bucket and "never deletes a drink the phone logged" (`KirokuWatchCore/LiveSessionController.swift`).
- **Units are computed twice.**
  - Legacy `calculateTotalUnits` multiplies count by a per-type factor and ignores volume/ABV. It's used by the session window, the overview, the last-session hook and `DataHandling`.
  - The Statistics pipeline (`buildDrinkEvents`, `sdu.ts`: grams = ml × abv × 0.789) handles volume/ABV.
- `CONST.SESSION_NAME_CHARACTER_LIMIT` (80) exists, but it only validates the note.

### 3.2 Writes and sync

- **Client.**
  - `SequentialQueue` + `PersistedRequests`, `OnyxUpdateManager` gap repair, `OfflineWithFeedback`.
  - Live-session buffering: `ONGOING_SESSION_DATA`, `ONGOING_SESSION_SYNC`, `UNSYNCED_SESSION_WRITES`, and the debounced live persist (`scheduleLiveSessionPersist` / `flushLiveSessionPersist`, 500 ms).
  - The queue's conflict-resolver hook exists; its only consumer drops duplicate `RECONNECT_APP` requests.
- **Server.**
  - `POST /v1/sessions/update` stores the session **verbatim**: a whole-object upsert where the last write wins.
  - It checks only `start_time`, plus limits of 50 keys, 64 KB and depth 8 (`routes/sessions/index.ts`).
  - Live sessions are mirrored in full into `user_status/{uid}` (`latest_session_id`, `latest_session`).
- **No idempotency keys** on any write. A replayed request is applied again.
- **Reconnect catch-up isn't wired** (#774): `AuthScreens.tsx` always calls `openApp()`, and the reconnect handler is commented out. Catch-up after being offline depends on the next Pusher event.
- The per-user update log exists and is solid: `publisher.publish` keeps a transactional `last_update_id` and a 500-entry log, and `GET /v1/updates` backfills.
- The auto-close sweep (`lib/sessions/closeStale.ts`) flips `ongoing` in an RTDB transaction, then finalizes with a plain multi-path update. It stays off unless `config/auto_close_default_hours` is set.

### 3.3 Surfaces and infrastructure

- **Home** (`src/screens/HomeScreen.tsx`) already has a compact calendar. A live session shows as a banner with a resume action. On a native cold start, `lastVisitedPath` is cleared, so the app opens on Home.
- The live route is `drinking-session/:sessionId/live`, reachable at `kiroku://`. iOS doesn't register the `kiroku://` scheme in `Info.plist`, though, so universal links (#1642) are the tap target to rely on.
- **Session photos are half built.**
  - `/v1/images/upload-url` + `/finalize` accept `kind: "session"`, with a `session_images/{uid}/{sessionId}/` prefix, a 5 MB cap and ownership checks.
  - Finalizing a session photo is a no-op stub.
  - Moderation (`lib/moderation.ts`) runs only when `IMAGE_MODERATION_ENABLED` is set.
  - The app has `CONST.IMAGE_UPLOAD_KIND.SESSION`, but nothing uses it.
- **GPS per drink** exists (`user_session_locations`).
- **Feature flags** are compile-time only: `FeatureFlags.isEnabled` reads `CONST.FEATURES`, with no remote override.
- **Version enforcement** is `app_settings.min_supported_version`, checked by the client, plus a server-forced 426.
- `GET /v1/users/:uid/sessions?from=` returns every session from a start time, **with no limit or cursor**.
- **Account close** nulls database subtrees but **deletes no storage objects** (neither `avatars/` nor `session_images/`).
- **No notifications or Live Activity** on `master` yet. Push is in flight (Kiroku#1640; the API side, kiroku-api#138, is merged).

---

## 4. Data model

The core idea: **a solo session and a shared session have the same shape.** A shared session is a session whose member list is longer than one. The append-heavy part (the drinks) is a map keyed by client-generated ids, so two people logging at the same time write to different keys and never conflict. The rare metadata fields (name, end time) are last-writer-wins, arbitrated by the server.

### 4.1 Where sessions live

| Path                                       | What                                                                            | Written by   |
| ------------------------------------------ | ------------------------------------------------------------------------------- | ------------ |
| `user_drinking_sessions/{uid}/{sessionId}` | A **solo** session (canonical), or **my projection** of a shared session        | server (ops) |
| `shared_sessions/{sessionId}`              | A **shared** session (canonical): meta, members, entries                        | server (ops) |
| `session_join_codes/{code}`                | Join code to session id, expiry, creator. Server-only, like #139's invite codes | server       |
| `user_status/{uid}`                        | Live-session mirror for friends (exists today); learns about shared sessions    | server       |

**Promotion on share.** Every session starts solo, canonical in `user_drinking_sessions`. The first time it gets a second member, or a join code is created for it, the server **promotes** it: it copies meta and entries into `shared_sessions/{sessionId}` and turns the owner's record into a projection. The session id doesn't change, so links, the live route and the Live Activity keep working. The ~95% of sessions that are never shared cost nothing extra, and reads of solo sessions don't change.

We considered the alternative, with every v2 session canonical in one collection and a projection for everyone. It's simpler to reason about, but it doubles every solo write, so we rejected it.

### 4.2 Session meta

```ts
type SessionMeta = {
  schema_version: 2;
  name: string; // auto-generated default ("Friday evening", localized), editable
  visibility: 'friends' | 'private';
  start_time: number;
  end_time: number;
  ongoing: boolean;
  timezone: string;
  auto_closed?: boolean; // set by the stale-session sweep (#1293)
  photos?: Record<PhotoId, SessionPhoto>;
  // shared sessions only
  admin_uid?: UserID;
  members_can_invite?: boolean; // default true
  closed_at?: number; // server time of the admin's close, for the late-entry rule
};

type SessionPhoto = {
  path: string;
  w: number;
  h: number;
  added_at: number;
  added_by: UserID;
};
```

`note` and `blackout` stay **private per member**. In a shared session they live only in each member's projection, never in the shared document.

### 4.3 Entries

```ts
type SessionEntry = {
  ts: number; // when the drink happened (skew-corrected, §5.5); retro-add allowed
  key: DrinkKey;
  count: number;
  volume_ml?: number;
  abv?: number; // 0..1
  source: 'phone' | 'watch' | 'live_activity' | 'web';
  author_uid: UserID; // who logged it
  target_uid: UserID | 'unclaimed'; // whose drink it is
  round_id?: string; // entries created by one "add to all" share this
  created_at: number; // server time
  edited_at?: number;
  deleted?: true; // tombstone; keys are never removed
  late?: true; // arrived after close, inside the grace window (§6)
  declined?: true; // a round drink its target declined; it returns to 'unclaimed'
};
```

- `entryId` is a client-generated push id (`generatePushID`), so it's time-sortable and can be created offline.
- In a solo session `author_uid === target_uid === owner`.
- `volume_ml` and `abv` fall back to `CONST.DRINK_DEFAULTS` exactly as the Statistics v2 SDU math does today (see `contributingGuides/STATISTICS_V2.md` §3).

### 4.4 Members (shared only)

```ts
type SessionMember = {
  role: 'admin' | 'member';
  status: 'invited' | 'active' | 'left' | 'removed';
  joined_at?: number;
  joined_via?: 'invite' | 'link' | 'code';
  invited_by?: UserID;
};
```

### 4.5 The projection contract

For every active or former member, the server keeps `user_drinking_sessions/{uid}/{sessionId}` in sync:

- meta fields the member may see (name, times, ongoing, timezone, photos), plus `shared: true` and the member's own `visibility`
- **only entries whose `target_uid` is that member**, so personal stats, the calendar and the watch see "my slice" as a normal session
- the member's private `note` and `blackout`

Projections are derived data. An idempotent **rebuild job** (the `status/sync` endpoint is the template) can regenerate any projection from the shared document, so a server bug makes a calendar wrong until the next rebuild, never corrupt.

**Visibility in shared sessions.** The shared timeline is visible to members only. Each member's friends see that member's slice, following that member's own `visibility`. A member who marks the session private hides their slice from their friends without hiding anything from the other members.

---

## 5. Write protocol

### 5.1 Ops

Every change is one small `POST` carrying an op:

```ts
type SessionOp = {
  opId: string; // client-generated, the idempotency key
  sessionId: string;
  type: OpType;
  payload: unknown; // per type
  client_ts: number;
};
```

| Op                                                                   | Who                                                       | Offline?        | Notes                                                                                   |
| -------------------------------------------------------------------- | --------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------- |
| `add_entry`                                                          | any active member (solo: owner)                           | yes             | `target_uid` = self, or `'unclaimed'`                                                   |
| `edit_entry`, `delete_entry`                                         | the entry's author or target; the admin can also delete   | yes             | delete writes a tombstone                                                               |
| `add_round`                                                          | any active member                                         | yes, optimistic | client pre-generates one `entryId` per target from its membership snapshot; replay-safe |
| `decline_entry`                                                      | the entry's target                                        | yes             | the drink goes back to `'unclaimed'` with `declined: true`                              |
| `claim_entry`                                                        | any active member                                         | yes, optimistic | compare-and-set on `target_uid === 'unclaimed'`; a lost race rolls back                 |
| `set_note`, `set_blackout`, `set_visibility`                         | the member, on their own projection                       | yes             |                                                                                         |
| `rename`, `add_photo`, `remove_photo`                                | admin; photos: any member adds, uploader or admin removes | queued          | re-validated at apply time                                                              |
| `close`, `remove_member`, `transfer_admin`, `set_members_can_invite` | admin                                                     | queued          | re-validated at apply time; can bounce with a permission error                          |
| `leave`                                                              | any active member                                         | yes             | the admin must transfer first, or the server hands admin to the longest-standing member |
| `create_join_code`, `invite`, `join`, `respond_invite`               | see §7                                                    | **no**          | online-only by design                                                                   |
| `start`, `end` (solo)                                                | owner                                                     | yes             | solo lifecycle, today's start/save flows expressed as ops                               |

### 5.2 Server apply

For each op the server:

1. Checks `opId`. If it was already applied, it answers success with the same result. The hardened queue **will** replay requests, and upstream Expensify treats a duplicate as success too.
2. Validates membership and role **against current state**, not the state the client saw.
3. Applies the op as **one RTDB multi-path update**: the entry or meta change, every affected member's projection, and every affected member's update log.
4. Publishes over the **existing per-user Pusher channels**. No per-session data channel is needed: each client keeps one sequenced stream, and the per-member update log with `lastUpdateID` cursors gives shared sessions catch-up replay for free.

At 40 members one entry touches about 80 paths (projection and update log per member), which is well inside RTDB's multi-path limits. Per-member rate limits on ops keep a runaway client from fanning out.

A per-session presence channel ("Petr is pouring one") is a later nice-to-have, for ephemeral state only.

### 5.3 Client

Each op goes through `API.write` with the three buckets: optimistic data (instant UI, my pending entries count in my own stats), success data, and failure data. It's queued in `SequentialQueue`, which survives restarts and never drops transient failures. The queue's conflict-resolver hook becomes the **op coalescer**, for example folding a burst of taps, or an edit right after an add, into one request, as upstream does for comment edits.

Permission failures (a stale admin action from an offline ex-admin) must take a **different failure path from network errors**, so they roll back cleanly instead of leaving an error the user can't dismiss. Upstream learned this the hard way (their `jsonCode` 460 handling).

### 5.4 Destructive membership changes

`remove_member` and `leave` are applied optimistically only as an annotation (pending removal) and committed in success data. That way a concurrent read can't bring back a half-removed member. The pattern is copied as-is from upstream.

### 5.5 Clocks

A phone that's ten minutes off would scramble a shared timeline. The client keeps a server-time offset, derived from server timestamps in API responses, and writes `ts` in corrected time. Upstream Expensify corrects client clocks the same way. Whether the fork kept that code needs checking in P; if not, P builds it. The server stamps `created_at` itself and never trusts client time for ordering decisions like the late-entry rule.

### 5.6 Solo sessions move onto ops: a committed phase

Solo sessions move to the op protocol **as part of W2**, before shared sessions ship. Keeping snapshot writes for solo and ops for shared would mean two write paths to reason about for as long as both exist, and the snapshot path is exactly the one that lets two writers clobber each other. That's already a live bug between the watch and the phone, which both write the full session. W2 rebuilds capture anyway, so that's the cheap moment.

Until then, the server **rejects legacy whole-session writes against shared ids**, so an old client can't overwrite a projection.

---

## 6. Offline and conflict policies

| Situation                                        | Rule                                                                                                                                                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Everyone logs their own drinks offline           | Disjoint keys; queues drain on reconnect; update replay catches everyone up. Nothing is lost.                                                                                                                         |
| Entry arrives after the admin closed the session | Accepted if `ts` is inside `[start_time, closed_at + 12 h]`, stored with `late: true`. The session doesn't reopen. Outside the window: rejected with a clear message, and the drink is offered as a new solo session. |
| Admin deletes an entry while its author edits it | **Tombstone wins.**                                                                                                                                                                                                   |
| Two members claim the same unclaimed drink       | First to reach the server wins (RTDB transaction, as in the auto-close sweep); the loser rolls back with "already claimed by X".                                                                                      |
| A round drink's target declines it               | It returns to `'unclaimed'` and stays in the session total.                                                                                                                                                           |
| Unclaimed drinks                                 | Count toward the session total, nobody's personal stats. Claimable at any time, including after the close.                                                                                                            |
| Stale admin op (the sender is no longer admin)   | Re-validated at apply time; bounces with a permission error and rolls back.                                                                                                                                           |
| A member leaves or is removed                    | Their entries stay attributed to them: it's their history. Their projection remains.                                                                                                                                  |
| A member deletes their account                   | Entries targeting them are removed and the totals recomputed; entries they logged for others stay, with the author anonymized.                                                                                        |
| Stale ongoing session (#1293 auto-close)         | Staleness uses the **last activity of any member**. Only the sweep or the admin closes a shared session.                                                                                                              |

---

## 7. Invites and joining

Two pieces already in flight are the foundation:

- **Personal friend invite links:** Kiroku#1642 and kiroku-api#139 (`app.kiroku.cz/add/<code>`, QR code, public preview, direct redeem, universal links, `PendingFriendInviteGuard`).
- **Push notifications:** Kiroku#1640 and kiroku-api#138 (FCM device registry, a notifier that respects opt-outs, blocks and bans).

### 7.1 One code per live session

Each shared-capable live session gets **one short code**, for example `K7QX2M`: 6 characters from an alphabet without look-alikes (no `0/O`, `1/I/L`). The same code powers:

- the **link** `app.kiroku.cz/s/<code>`
- the **QR code** of that link
- **manual entry** on a "Join session" screen

Six characters are enough because the code is short-lived: it dies when the session ends, the admin can reset it, and joins are rate-limited. Personal friend codes are 10 characters because they live forever.

### 7.2 The ways in

| Situation                        | Flow                                                                                                                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same table, has the app          | Host taps **Invite** on the live screen: a big QR code, the short code under it, and a "Share link" button. Guest scans with the system camera; the universal link opens the Join screen.                                        |
| Same table, no app yet           | Same scan. The web preview shows the session and the store buttons. After installing, the guest scans again or types the short code. This covers the gap #1642 lists (links don't survive an install) without a third-party SDK. |
| Not there yet (a friend)         | Pick friends from a list. They get a push ("Petr invited you to Friday at U Fleků") and a card on Home, and can accept or decline.                                                                                               |
| Signed out when opening the link | The code is stashed and the Join screen reopens after sign-in and onboarding: `PendingFriendInviteGuard` generalized to both kinds of invite.                                                                                    |
| No signal (the bar basement)     | Joining needs a connection. Meanwhile, drinks for the newcomer are logged as **unclaimed**; they claim them once they're in (§7.4).                                                                                              |

"Members can invite" is on by default, so whoever is holding a phone can show the QR code. The admin can turn it off, reset the code, and remove members.

### 7.3 The Join screen and the friendship confirmation

The Join screen shows a preview: session name, host, member count, how long it's been live. The preview uses public fields only (the same ones #139 exposes).

If the joiner **isn't friends with the host**, joining makes them friends, and the screen must say so plainly before anything happens. Nobody should reveal their history to someone by accident. Draft copy (final wording follows `contributingGuides/COPY_VOICE.md`):

> **Join Friday at U Fleků?**
> You and Petr will become friends. Petr will see your sessions and stats the way friends do, and you'll see theirs.
> Everyone in this session will see the drinks you log in it.
> [Join and add Petr] [Cancel]

Details:

- Friends-only visibility settings (`hide_from_all`, per-friend hiding) keep working, and the confirmation links to them.
- If they're already friends with the host, the screen still shows the one-line "Everyone in this session will see the drinks you log in it" once, then joins.
- Other members don't become friends. The member list shows their name and avatar, with an **Add friend** button on each row.

### 7.4 After joining: claiming drinks

If the session has unclaimed drinks, the new member immediately sees **"These drinks were logged for people who hadn't joined yet. Which are yours?"** They pick any number of them, each one a `claim_entry` op. The same list stays reachable from the session screen at any time, since claims never expire.

### 7.5 Joining while you have your own live session

The Join screen offers **"Move your 3 drinks into this session"** (the drinks become entries of the shared session, attributed to you, and your solo session is removed) or **"Keep separate"** (your solo session stays live).

### 7.6 Guardrails

- The 40-member cap is enforced on the server.
- A block in either direction between the joiner and **any** active member gets the same neutral refusal #139 uses, so nobody learns who blocked whom.
- Joins and code lookups are rate-limited per user and per IP.
- Session names go through the existing profanity filter.
- The invite push is a new `session_invite` type in the #138 notifier, with its own opt-out.

---

## 8. Live-first UX

**In-app (W0, ships first, standalone).** While a session is live, Home shows a live card above the calendar: elapsed timer, total units, inline quick-add for the usual drinks, a photo shortcut. On a **cold start with a live session, the app opens straight into it** (cold start only, so checking stats mid-session doesn't get hijacked).

**Lock screen (W4, iOS and Android together).**

- **iOS**: a WidgetKit extension with a Live Activity and the Dynamic Island. An ActivityKit bridge module shaped like `WatchBridge` starts it with the session, updates it per drink, and ends it with a summary. The timer renders natively (`Text(timerInterval:)`). "+1" buttons via App Intents (iOS 17+) are a stretch goal.
- **Android**: an ongoing notification (its own channel, a chronometer, tap-through via the live deep link), with `timeoutAfter` matched to the auto-close hours so it can't outlive a session the sweep closed.
- **Shared sessions need push updates.** Other members' drinks change your totals while your app is in the background, so the Live Activity can't only update when you log something. The Live Activity push token is registered in #138's device registry, and the server sends updates on ops that change a member's view. Solo sessions don't need this.
- Watch: shows the session name and timer.

---

## 9. Session identity

- **Name**: an auto-generated default ("Friday evening", localized) that's editable. The admin renames shared sessions.
- **Photos**: fill in the server's session-photo finalize step, generalize the image upload component, and add a gallery on the session screen. In shared sessions any member can add photos; the uploader or the admin can remove them.
- **Before photos are visible to anyone else**: image moderation on for session photos, report/block extended to cover session photos (the #757 pipeline), and account close deleting storage objects. Today it only nulls database paths and leaves both `avatars/` and `session_images/` behind, which is worth fixing on its own.
- **Session detail page**: the Strava-style activity page, evolved from the session summary.

---

## 10. Feed

Home: live card (while live), then **calendar**, then the **feed** below it. Feed cards show name, relative time, duration, units and SDU, drink-type icons, a photo thumbnail, a live badge, and friends who are drinking now (from `user_status`). Shared sessions get one card per session, not one per member.

The feed needs newest-first cursor pagination on the sessions endpoint, and app open shouldn't keep dumping the whole history. Card summaries are computed on the client at today's scale and can be denormalized later. The feed ships last on purpose: it only looks good once sessions have names and photos.

---

## 11. Migration and compatibility

- `schema_version: 2` on every new session. Old sessions are read through an **adapter** that turns `drinks[timestamp][key]` buckets into entries in memory. Statistics already does this conversion internally; this is the moment to have **one** unit computation instead of two.
- A **one-shot, lossless backfill** in kiroku-cli (one entry per bucket key, `source: 'phone'`), dry run first. Then bump the minimum supported version. Version enforcement is client-side only today, which is fine here because old clients' writes still go through the adapter.
- Server payload limits on sessions get revisited for entry-heavy sessions and photo metadata.
- The watch's Codable models change in the same PR train (the watch is an embedded target, so it ships in lockstep).
- The auto-close sweep (#1293) and its client reconciler learn about shared sessions and projections (§6).

---

## 12. Workstreams and order

There's one umbrella epic, one issue per workstream and one PR train per workstream, staged through TestFlight and internal testing. Every user-visible piece sits behind a feature flag. Flags are compile-time only today, so P adds a remote override (read from server config) to let a flag act as a kill switch without a release.

| #   | Workstream              | Contents                                                                                                                        | Depends on                          |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| W0  | Live quick wins         | Live card on Home, elapsed timer, inline quick-add, cold-start auto-open                                                        | nothing; ship now                   |
| P   | Prerequisites           | Idempotency keys on writes, reconnect re-baseline wiring (#774), op plumbing (endpoint shell, coalescer, clock offset)          | nothing                             |
| W1  | Schema v2               | This RFC, entry model + adapter, meta fields, one unit computation, kiroku-cli backfill, payload limits                         | RFC accepted                        |
| W2  | Capture rework          | Volume/ABV presets, session timeline, editable times, retro-add, undo, per-entry edit/delete, source; **solo moves onto ops**   | W1, P                               |
| W3  | Session identity        | Names, photos end to end, visibility UI, session detail page                                                                    | W1; parallel with W2                |
| W4  | Live on the lock screen | iOS Live Activity and Android ongoing notification together, push updates, watch parity                                         | W0, push (#1640/#138)               |
| W5  | Feed                    | Feed below the calendar, newest-first pagination, friends drinking now                                                          | W3                                  |
| W6a | Shared core             | Promotion, join code/link/QR, Join screen + friendship confirmation, friend invites, entries, fan-out, projections, rebuild job | W2, invite links (#1642/#139), push |
| W6b | Rounds, claims, admin   | `add_round`, decline, claims and the claim prompt, admin ops, members can invite                                                | W6a                                 |
| W6c | Shared surfaces         | Shared live screen, feed cards, invite and round notifications, shared Live Activity updates                                    | W6b, W4, W5                         |

**Why this order:** capture fidelity compounds. Every session logged before W2 stays coarse forever, so schema and capture go first and the flashy surfaces follow. The prerequisites (P) moved ahead of W2 so solo sessions can move onto ops there, and shared sessions never have to live next to snapshot writes.

**Testing.** Shared sessions need multi-client tests: two Playwright browser contexts in one session, plus replay and idempotency unit tests in the style of the existing offline-durability tests.

---

## 13. Risks

1. **Scope.** Shared sessions alone are roughly as big as everything else combined. Flag-gated and phased it's fine; underestimated it isn't.
2. **Consent.** Other people writing into my health data is the sharpest product edge. The mitigations: decline on round drinks, the friendship confirmation (§7.3), per-member rate limits, and block checks on join.
3. **Projection drift.** A server bug makes someone's calendar wrong. Mitigation: projections are derived, and the rebuild job regenerates them.
4. **Transitional duality.** Until W2 lands, solo sessions write snapshots. Mitigation: legacy writes against shared ids are rejected (§5.6).
5. **GDPR and moderation.** Account deletion must scrub shared sessions; photos need moderation before anyone else sees them.

---

## 14. Open questions

None. The six questions raised in review were settled on 2026-09-11 and are now decisions 19 to 24 in §2.
