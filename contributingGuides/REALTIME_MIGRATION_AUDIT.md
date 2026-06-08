# Firebase RTDB → kiroku-api Migration — Final Audit

**Date:** 2026-06-05
**Scope:** Definitive accounting of every `firebase/database` touch point in `src/`,
classification (keep / dead / needs-migration / type-only), safe dead-code removal,
and a prioritized follow-up list for the remaining real gaps.
**Epics:** [#778](https://github.com/PetrCala/Kiroku/issues/778),
[#809](https://github.com/PetrCala/Kiroku/issues/809),
[#810](https://github.com/PetrCala/Kiroku/issues/810)

This PR performs the audit **plus the safe dead-code cleanup only**. It does **not**
perform any of the remaining feature cutovers (category C) — those are listed as
follow-ups.

---

## 1. Verdict

**The RTDB migration is ~90% complete.** All writes, all change-listeners
(`onValue`/`onChild*`), all current-user reads, friend sessions/profiles/statuses,
friend preferences, and user search are migrated to kiroku-api. What remains touching
`firebase/database` at **runtime** is:

- **1 legitimate, permanent keep** — the `db` handle provider (`FirebaseContext`).
- **1 keep, now SEVERED** — `generateDatabaseKey` was the last RTDB-handle dependency on
  the write path. A follow-up on this branch replaced it with `src/libs/generatePushID.ts`,
  a local Firebase-push-ID-shaped generator (identical 20-char format, no `db` handle), so
  session-key minting no longer touches `firebase/database`.
- **4 real read gaps** (category C) — all cross-user/pre-auth `get()`-style reads:
  cross-user friends list, admin nickname resolution, OAuth user-exists pre-check, and
  the pre-auth signup version gate. **3 of the 4 already have a server endpoint** and
  are quick client cutovers; only the pre-auth version gate needs a new unauthenticated
  endpoint.

After this PR's dead-code removal (and the `generatePushID` follow-up on this branch), the
only remaining `firebase/database` **value imports** in `src/` are in exactly three files:
`FirebaseContext.tsx` (handle), `baseFunctions.ts` (`readDataOnce`), and `User.ts`
(`ref`/`get` for the OAuth user-exists check).

---

## 2. Full inventory (post-cleanup target state)

`firebase/database` imports across `src/` and their classification:

| File                                           | Symbol(s)                                                    | What it does                                                                                                             | Class                         |
| ---------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `src/context/global/FirebaseContext.tsx`       | `getDatabase`, `connectDatabaseEmulator` (+ `type Database`) | Constructs the singleton `db` handle exposed via `useFirebase()`; wires the emulator in test mode                        | **A — keep**                  |
| `src/database/baseFunctions.ts`                | ~~`push`, `child`, `ref`~~ (removed)                         | `generateDatabaseKey` **removed**; key minting moved to local `src/libs/generatePushID.ts` (no `db` handle, same format) | **A — severed**               |
| `src/database/baseFunctions.ts`                | `get`, `ref`                                                 | `readDataOnce<T>` — one-shot read; still called by the 4 category-C gaps below                                           | **A — keep until C done**     |
| `src/libs/actions/User.ts`                     | `ref`, `get` (+ `type Database`)                             | `userExistsInDatabase` — reads `users/$uid/profile` to test existence (OAuth path)                                       | **C — needs-migration**       |
| `src/libs/actions/User.ts`                     | `readDataOnce<Profile>`                                      | `fetchUserNicknames` — cross-user display-name resolution for admin screens                                              | **C — needs-migration**       |
| `src/libs/actions/User.ts`                     | `readDataOnce<AppSettings>`                                  | `signUp` pre-auth app-version gate (reads `config/app_settings`)                                                         | **C — needs-migration**       |
| `src/screens/Profile/ProfileScreen.tsx`        | `readDataOnce<UserList>`                                     | Reads the **viewer's own** friends list when viewing another user (common-friends count)                                 | **C — needs-migration**       |
| `src/screens/Profile/FriendsFriendsScreen.tsx` | `readDataOnce<UserList>`                                     | Reads **another user's** friends list                                                                                    | **C — needs-migration**       |
| `src/components/Social/SearchWindow.tsx`       | `type Database` only                                         | Types an optional `database?` arg plumbed to the `onSearch` callback (search already migrated)                           | **D — type-only**             |
| `src/hooks/useStartEditSessionForDate.ts`      | ~~`type Database`~~ (removed)                                | `db` param + type removed by the A.2 severing                                                                            | **D — resolved**              |
| `src/libs/actions/DrinkingSession.ts`          | ~~`type Database`~~ (removed)                                | `db` params + `generateDatabaseKey` call removed by the A.2 severing                                                     | **D — resolved**              |
| `src/libs/actions/Profile.ts`                  | `type Database` only                                         | Types `db` in `fetchUserProfiles`/`fetchUserStatuses`; param documented "Unused (retained for call-site compatibility)"  | **D — type-only (vestigial)** |
| `src/screens/Social/FriendRequestScreen.tsx`   | `type Database` only                                         | Types `database` plumbed into `Profile.fetchUserProfiles` (which ignores it)                                             | **D — type-only (vestigial)** |

**RTDB write/query/listener APIs (`set`, `update`, `remove`, `onValue`, `onChild*`,
`off`, `runTransaction`, `orderByChild`, `query`, `startAt`, `limitToFirst`, …):**
after this PR, **zero** call sites remain in `src/`. (`onValue`/`off` lived only in the
two dead listener helpers removed below; the rest were already migrated.)

---

## 3. Classification detail

### A — Legitimate keep

1. **`FirebaseContext.tsx` (`getDatabase`)** — the `db` handle provider. Permanent as
   long as anything (e.g. `readDataOnce` for the category-C reads) needs a handle, and
   Firebase Auth + Storage are still provided from the same context.
2. **`generateDatabaseKey` (`baseFunctions.ts`) — SEVERED (follow-up on this branch).**
   It was the single remaining write-path dependency on the RTDB handle:
   `push(child(ref(db)))` derived a chronologically-sortable unique key **locally** from
   the SDK pushId algorithm (no network I/O), but still needed the `db` handle. It is now
   replaced by `src/libs/generatePushID.ts`, a faithful local port of Firebase's
   `generatePushID` (secure RNG via `expo-crypto` `getRandomBytes`). The keys are
   **format-identical** to Firebase push IDs — 20 chars, same 64-char sort-preserving
   alphabet, timestamp-prefixed — so they stay co-sortable with every existing session
   key. A UUID was explicitly **not** used (wrong length/charset, not time-sortable).
   `generateDatabaseKey` is deleted, and `DrinkingSession.ts` /
   `useStartEditSessionForDate.ts` have dropped their `Database` type imports and `db`
   params. The session write path no longer touches `firebase/database`.

### B — Dead code (removed in this PR)

Every removal below was verified with `git grep` to have **no consumers** anywhere in
the repo (src + tests + config). See the PR body for the exact grep evidence.

| Removed symbol / file                                                                                           | Why dead                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `baseFunctions.ts: listenForDataChanges`                                                                        | Listener-based reads fully migrated; no importers                                                                                                                                                                                                |
| `baseFunctions.ts: listenForQueryChanges`                                                                       | Windowed-query listener migrated to `useDrinkingSessionsFetch`; no importers                                                                                                                                                                     |
| `baseFunctions.ts: fetchDataForUsers`                                                                           | No external consumers (only used by `fetchDisplayDataForUsers`, also dead)                                                                                                                                                                       |
| `baseFunctions.ts: fetchDisplayDataForUsers`                                                                    | No consumers (superseded by `Profile.fetchUserProfiles`/`fetchUserStatuses` batch reads)                                                                                                                                                         |
| `baseFunctions.ts` imports `onValue`, `off`, `type Query`, `Profile`, `ProfileList`, `UserStatusList`, `UserID` | Became unused after the above                                                                                                                                                                                                                    |
| `src/hooks/useFetchData/` (`index.ts`, `utils.ts`, `types.ts`)                                                  | The `useFetchData` hook is **never called** — only stale JSDoc mentions remain; per-key reads replaced by `useFriendProfile`/`useFriendPreferences`/`useDrinkingSessionsFetch`                                                                   |
| `src/hooks/useRefresh.ts`                                                                                       | Imported nowhere; depended only on the dead `useFetchData/types` + `RefetchDatabaseData`                                                                                                                                                         |
| `src/types/utils/RefetchDatabaseData.ts`                                                                        | Used only by the two dead hooks above                                                                                                                                                                                                            |
| `src/libs/FriendUtils.ts: fetchUserFriends`                                                                     | **Orphan** — exported but imported nowhere. The live cross-user friend reads are in `ProfileScreen`/`FriendsFriendsScreen`, which call `readDataOnce` directly. (This corrects the original audit premise that `FriendUtils` held a _live_ gap.) |
| `eslint.seatbelt.tsv` entry for `src/hooks/useFetchData/index.ts`                                               | Stale grandfathered-violation row for a now-deleted file                                                                                                                                                                                         |

`readDataOnce` is **retained** in `baseFunctions.ts` (it still has live consumers — the
category-C reads below). `generateDatabaseKey` has been **removed** (severed — see A.2).

### C — Needs-migration (real gaps — REPORT only, not migrated here)

Cross-referenced against `kiroku-api/src/routes/`:

| #   | Gap                              | Call site(s)                                                                                      | RTDB path                           | Endpoint status                                                                                                                                               | Recommended cutover                                                                                                                                                                                                         |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Cross-user **friends list** read | `ProfileScreen.tsx:156` (viewer's own friends), `FriendsFriendsScreen.tsx:156` (target's friends) | `users/$uid/friends`                | ✅ **Endpoint EXISTS** — `GET /v1/users/:uid/friends` (PUBLIC, `users/index.ts:514`); also surfaceable via `GET /v1/users/batch`                              | **Quick client cutover.** Replace the two `readDataOnce<UserList>` calls with the friends endpoint (new `READ_COMMAND` + client method), merging into `userDataList[uid].friends` as the server already shapes it           |
| C2  | Admin **nickname resolution**    | `User.ts:397 fetchUserNicknames` → `SeeBugsScreen.tsx:57`, `SeeFeedbackScreen.tsx:59`             | `users/$uid/profile` (display_name) | ✅ **Endpoint EXISTS** — `GET /v1/users/batch?fields=profile` (`users/index.ts:360`), already wrapped by `Profile.fetchUserProfiles`                          | **Quick client cutover.** Reimplement `fetchUserNicknames` on top of `fetchUserProfiles` (map → `display_name`), OR fold display-name resolution into the admin feedback/bugs GET responses server-side                     |
| C3  | OAuth **user-exists pre-check**  | `User.ts:103 userExistsInDatabase` → `signInWithOAuth` (`User.ts:481`)                            | `users/$uid/profile`                | ✅ **Provisioning 409 EXISTS** — `POST /v1/provisioning` returns `409 "User already exists"` (`provisioning/index.ts:160`)                                    | **Client cutover (needs care).** Drop the pre-check; always call `provisionUser` and treat a `409` as "already provisioned → proceed to sign-in". The OAuth branch currently uses the boolean to decide provision-vs-signin |
| C4  | **Pre-auth signup version gate** | `User.ts:662 signUp` (`readDataOnce<AppSettings>`)                                                | `config/app_settings`               | ❌ **Needs server endpoint** — runs **before** Firebase Auth account creation, so there is no ID token; `GET /v1/app/open` is authenticated and unusable here | **Needs a new unauthenticated endpoint** (e.g. `GET /v1/app/config` / `/v1/app/min-version`) returning the minimum-creation version, then swap the `readDataOnce` for that fetch                                            |

### D — Type-only imports (cosmetic, intentionally left)

`import type {Database}` annotations that only type a `db`/`database` parameter. None
perform RTDB I/O. The two that flowed into `generateDatabaseKey` (`DrinkingSession.ts`,
`useStartEditSessionForDate.ts`) are **gone** with the A.2 severing; the rest type a
function whose `db` arg is already vestigial (`Profile.fetchUserProfiles`/`fetchUserStatuses`
document it as "Unused (retained for call-site compatibility)").

The remaining ones are left untouched to avoid churn. They become trivially removable once
C1–C4 land (removing the `Database`-typed plumbing through `User.ts`, the profile screens,
and `FriendRequestScreen`/`SearchWindow`). The `generateDatabaseKey` → local
`generatePushID` severing has already removed the `Database` imports from
`DrinkingSession.ts` and `useStartEditSessionForDate.ts`.

At that point `FirebaseContext.tsx` would be the **only** `firebase/database` importer in
`src/`, and the RTDB migration would be 100% complete on the client read/write paths.

---

## 4. Prioritized follow-ups (category C)

Ordered by effort/value:

1. **C1 — cross-user friends list** _(quick, endpoint exists)._ Highest value, lowest
   risk: two direct `readDataOnce` call sites, server route already PUBLIC and shaped.
2. **C2 — admin nickname resolution** _(quick, endpoint exists)._ Admin-only surface;
   reuse `fetchUserProfiles`.
3. **C3 — OAuth user-exists pre-check** _(quick endpoint, careful logic)._ Endpoint
   exists (409), but the provision-vs-signin branching needs a careful rewrite + test of
   the replay/duplicate path.
4. **C4 — pre-auth version gate** _(needs server work)._ Blocked on a new unauthenticated
   kiroku-api endpoint; coordinate with the kiroku-api repo. Lowest urgency — the gate is
   a soft "is your app new enough to create an account" check.

Severing `generateDatabaseKey` (done on this branch via a local `generatePushID` port —
**not** a UUID, so the Firebase push-ID key format is preserved) closed out the write-path
handle dependency.
