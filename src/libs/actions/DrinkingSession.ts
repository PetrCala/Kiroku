import type {
  DrinkingSession,
  DrinkingSessionId,
  DrinkingSessionList,
  DrinkKey,
  DrinksToUnits,
  DrinksTimestamp,
  OngoingSessionSync,
  UserDataList,
} from '@src/types/onyx';
import * as Localize from '@libs/Localize';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {User} from 'firebase/auth';
import CONST from '@src/CONST';
import generatePushID from '@libs/generatePushID';
import Onyx from 'react-native-onyx';
import type {OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {buildSessionTimeParts} from '@libs/Statistics/sessionTimeParts';
import {READ_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
import type Response from '@src/types/onyx/Response';
import type {OpenFriendDrinkingSessionsParams} from '@libs/API/parameters';
import type {OnyxKey} from '@src/ONYXKEYS';
import ONYXKEYS from '@src/ONYXKEYS';
import Navigation from '@libs/Navigation/Navigation';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import {differenceInCalendarDays} from 'date-fns';
import {toZonedTime} from 'date-fns-tz';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import type {ValueOf} from 'type-fest';
import {Alert, InteractionManager} from 'react-native';

let ongoingSessionData: DrinkingSession | undefined;
Onyx.connect({
  key: ONYXKEYS.ONGOING_SESSION_DATA,
  callback: value => {
    // Assign unconditionally (including clearing on null) so the finalize/discard
    // `Onyx.set(ONGOING_SESSION_DATA, null)` actually drops this cached copy. The
    // debounced live persist reads this cache at flush time; a stale (ongoing:true)
    // copy would let it re-emit the session as ongoing after the finalize.
    ongoingSessionData = value ?? undefined;
    maybeResumeLiveSessionPersist();
  },
});

// Persisted bookkeeping for the live-session persist pipeline: which local edit
// stamp was enqueued to / acknowledged by the server. Debounce timers die with
// the JS runtime, so after an app kill this is the only record that the hydrated
// `ONGOING_SESSION_DATA` buffer holds edits the server has never seen. See
// `markLiveSessionEdited` / `hasUnsyncedLiveSessionEdits`.
let ongoingSessionSync: OngoingSessionSync | undefined;
// Onyx fires the initial connect callback (with undefined for an absent key)
// only after the storage read resolves. Until then "no marker" is
// indistinguishable from "marker not hydrated yet", and acting on the latter
// could roll back or wipe offline edits, so sync decisions wait for this flag.
let ongoingSessionSyncLoaded = false;
Onyx.connect({
  key: ONYXKEYS.ONGOING_SESSION_SYNC,
  callback: value => {
    ongoingSessionSync = value ?? undefined;
    ongoingSessionSyncLoaded = true;
    maybeResumeLiveSessionPersist();
  },
});

// Cached copy of the user-data list so the session-write paths can read the
// current `earliest_session_at` without an extra Firebase round trip on every
// write. Authoritative state still lives in Firebase; this is just for the
// "is the new session a strict improvement?" shortcut.
let userDataList: UserDataList | undefined;
Onyx.connect({
  key: ONYXKEYS.USER_DATA_LIST,
  callback: value => {
    userDataList = value ?? undefined;
  },
});

/**
 * Optimistic `merge cachedDrinkingSessions { [uid]: { [sessionId]: session } }`,
 * mirroring the `onyxData` the kiroku-api sessions endpoints emit. A `null`
 * `session` removes it from the cached snapshot (Onyx merge-delete semantics).
 */
function cachedSessionPatch(
  uid: UserID,
  sessionId: DrinkingSessionId,
  session: DrinkingSession | null,
): OnyxUpdate {
  return {
    onyxMethod: Onyx.METHOD.MERGE,
    key: ONYXKEYS.CACHED_DRINKING_SESSIONS,
    value: {[uid]: {[sessionId]: session}},
  };
}

/** Optimistic `merge userDataList { [uid]: { earliest_session_at } }`. */
function earliestPatch(uid: UserID, earliest: number): OnyxUpdate {
  return {
    onyxMethod: Onyx.METHOD.MERGE,
    key: ONYXKEYS.USER_DATA_LIST,
    value: {[uid]: {earliest_session_at: earliest}},
  };
}

/**
 * Optimistic data for a session upsert: the cached-snapshot merge plus, when the
 * new `start_time` strictly lowers the floor (or there is no floor yet), the
 * `earliest_session_at` merge. Non-strict edits (which may move the previously
 * earliest session later) are left to the server, which recomputes the floor and
 * returns/pushes the authoritative value — the inline response is idempotent.
 */
function sessionUpsertOptimisticData(
  uid: UserID,
  sessionId: DrinkingSessionId,
  session: DrinkingSession,
): OnyxUpdate[] {
  const optimisticData: OnyxUpdate[] = [
    cachedSessionPatch(uid, sessionId, session),
  ];
  const currentEarliest = userDataList?.[uid]?.earliest_session_at;
  if (currentEarliest === undefined || session.start_time < currentEarliest) {
    optimisticData.push(earliestPatch(uid, session.start_time));
  }
  return optimisticData;
}

/**
 * Optimistic CLEAN REPLACE of a cached session: delete the entry, then re-add it
 * in the same `Onyx.update` batch. A plain merge can't drop drinks the user
 * removed during the session (Onyx merge keeps keys omitted from the new value),
 * so finishing/editing a session that had drinks removed would leave those
 * removed drinks accumulated in the cached snapshot — the saved session would then
 * display far more drinks/units than it actually has. Replacing clears that.
 */
function cachedSessionReplace(
  uid: UserID,
  sessionId: DrinkingSessionId,
  session: DrinkingSession,
): OnyxUpdate[] {
  return [
    {
      onyxMethod: Onyx.METHOD.MERGE,
      key: ONYXKEYS.CACHED_DRINKING_SESSIONS,
      value: {[uid]: {[sessionId]: null}},
    },
    cachedSessionPatch(uid, sessionId, session),
  ];
}

/**
 * Optimistic data for finalizing/saving a session. Like
 * `sessionUpsertOptimisticData`, but clean-replaces the cached snapshot (see
 * `cachedSessionReplace`) so drinks removed during the session don't linger in the
 * cache and inflate the saved session's unit count.
 */
function sessionFinalizeOptimisticData(
  uid: UserID,
  sessionId: DrinkingSessionId,
  session: DrinkingSession,
): OnyxUpdate[] {
  const optimisticData = cachedSessionReplace(uid, sessionId, session);
  const currentEarliest = userDataList?.[uid]?.earliest_session_at;
  if (currentEarliest === undefined || session.start_time < currentEarliest) {
    optimisticData.push(earliestPatch(uid, session.start_time));
  }
  return optimisticData;
}

// let editSessionData: DrinkingSession | undefined;
// Onyx.connect({
//   key: ONYXKEYS.EDIT_SESSION_DATA,
//   callback: value => {
//     if (!value) {
//       return;
//     }
//     editSessionData = value;
//   },
// });

/**
 * Set the edit session data object in Onyx so that it can be modified. This function should be called only if the relevant object already exists in the onyx database.
 *
 * @param sessionId The ID of the session
 * @param newData The new data to set
 */
async function updateLocalData(
  onyxKey: OnyxKey,
  newData: DrinkingSession | null,
  sessionId?: DrinkingSessionId,
): Promise<void> {
  let dataToSet: DrinkingSession | null = null;
  if (newData) {
    if (!sessionId) {
      throw new Error('You must specify the session ID.');
    }
    dataToSet = {id: sessionId, ...newData};
  }
  // Keep the synchronous cache in lockstep with this write so a follow-up mutation
  // reads the fresh value rather than waiting on the async Onyx.connect refresh.
  DSUtils.setLocalSessionCache(onyxKey, dataToSet ?? undefined);
  await Onyx.set(onyxKey, dataToSet);
}

// Server persistence for the live (ongoing) session is debounced so rapid drink
// taps stay snappy: each mutation writes `ONGOING_SESSION_DATA` synchronously
// (instant UI) and only (re)arms this timer, so a burst of taps coalesces into a
// single `UPDATE_SESSION` once the user pauses. The write carries NO optimistic
// `cachedDrinkingSessions` data on purpose — that snapshot feeds Home/Stats,
// which sit behind the live modal; merging into it on every tap re-rendered them
// on the touch frame. The server echo updates the snapshot once the request
// resolves, off the touch frame. Finalize/discard call `cancelLiveSessionPersist`
// and then write the full session themselves, so a debounced live write can never
// land after them.
const LIVE_SESSION_PERSIST_DEBOUNCE_MS = 500;
let liveSessionPersistTimer: ReturnType<typeof setTimeout> | null = null;
let liveSessionPersistInteraction: {cancel: () => void} | null = null;

/**
 * Whether a debounced live-session persist is armed or deferred but not yet sent.
 * While true this device has un-persisted live edits, so the cached snapshot lags
 * the local `ONGOING_SESSION_DATA` buffer — `syncLocalLiveSessionData` uses this
 * to avoid rolling the buffer back to the (older) snapshot.
 */
function hasPendingLiveSessionPersist(): boolean {
  return (
    liveSessionPersistTimer !== null || liveSessionPersistInteraction !== null
  );
}

/** Cancel a scheduled-but-not-yet-sent debounced live-session persist. */
function cancelLiveSessionPersist(): void {
  if (liveSessionPersistTimer) {
    clearTimeout(liveSessionPersistTimer);
    liveSessionPersistTimer = null;
  }
  if (liveSessionPersistInteraction) {
    liveSessionPersistInteraction.cancel();
    liveSessionPersistInteraction = null;
  }
}

/**
 * Record a local edit to the live-session buffer. The stamp is written both to
 * the synchronous cache and to persisted Onyx so it survives an app kill:
 * `editedAt > syncedAt` marks the buffer as holding edits the server never
 * acknowledged, and `editedAt > enqueuedAt` marks edits that never even reached
 * the request queue (killed inside the debounce window) and so must be
 * re-enqueued on the next launch. Strictly monotonic (`prev + 1` floor) so an
 * edit landing in the same millisecond as a flush still reads as newer.
 */
function markLiveSessionEdited(sessionId: DrinkingSessionId): void {
  const previous =
    ongoingSessionSync?.sessionId === sessionId
      ? ongoingSessionSync
      : undefined;
  const next: OngoingSessionSync = {
    // A changed session id starts fresh stamps; stale enqueued/synced values
    // from an older session must not mask the new session's edits.
    ...(previous ?? {}),
    sessionId,
    editedAt: Math.max(Date.now(), (previous?.editedAt ?? 0) + 1),
  };
  ongoingSessionSync = next;
  Onyx.set(ONYXKEYS.ONGOING_SESSION_SYNC, next);
}

/**
 * Whether the live-session buffer holds local edits for `sessionId` that no
 * successful `UPDATE_SESSION` has acknowledged yet. While true, the cached
 * snapshot cannot reflect those edits (the live persist deliberately writes no
 * optimistic snapshot data), so the buffer must stay authoritative and must not
 * be rolled back to the snapshot. Survives restarts, unlike the in-memory
 * `hasPendingLiveSessionPersist`.
 */
function hasUnsyncedLiveSessionEdits(sessionId: DrinkingSessionId): boolean {
  return (
    ongoingSessionSync?.sessionId === sessionId &&
    ongoingSessionSync.editedAt > (ongoingSessionSync.syncedAt ?? 0)
  );
}

/**
 * Clear the live-session sync bookkeeping. Called when the live session stops
 * existing as such: on start (fresh session, fresh stamps), and on finalize/
 * discard (those requests carry the full session themselves, so any stamps are
 * moot and must not linger to shadow a future session).
 */
function clearLiveSessionSyncState(): void {
  ongoingSessionSync = undefined;
  Onyx.set(ONYXKEYS.ONGOING_SESSION_SYNC, null);
}

/**
 * Re-arm the debounced live persist after a restart when the hydrated buffer
 * holds edits that never reached the request queue (the app was killed inside
 * the debounce window). Runs from both hydration callbacks above, so it fires
 * once both the buffer and the sync stamps are available, whichever lands
 * last. Guarded by `enqueuedAt` (not `syncedAt`): edits that are already
 * queued offline replay by themselves, and only THIS device's un-enqueued
 * edits may trigger a write, so a device that merely adopted the session
 * cross-device never re-emits stale data.
 */
function maybeResumeLiveSessionPersist(): void {
  const session = ongoingSessionData;
  const sync = ongoingSessionSync;
  if (!session?.ongoing || !session.id || sync?.sessionId !== session.id) {
    return;
  }
  if (sync.editedAt <= Math.max(sync.enqueuedAt ?? 0, sync.syncedAt ?? 0)) {
    return;
  }
  if (hasPendingLiveSessionPersist()) {
    return;
  }
  scheduleLiveSessionPersist();
}

/**
 * Persist the current live session via kiroku-api. Reads the latest
 * `ONGOING_SESSION_DATA` at flush time (not a captured snapshot) so it always
 * sends the newest drinks; if the session was finalized/discarded in the
 * meantime the cache is already cleared and there is nothing to send. The server
 * upserts the session and — because `sessionIsLive` — mirrors it into the user's
 * live status for cross-device visibility.
 */
function flushLiveSessionPersist(): void {
  const session = ongoingSessionData;
  if (!session?.ongoing || !session.id) {
    return;
  }
  // Stamp how far this flush covers the local edits: `enqueuedAt` synchronously
  // (the request now exists in the persisted queue, so a restart must not
  // re-enqueue these edits), `syncedAt` via successData (only a successful
  // response proves the server, and therefore any future snapshot, has them).
  const sync = ongoingSessionSync;
  const coversEditedAt =
    sync?.sessionId === session.id ? sync.editedAt : undefined;
  if (sync && coversEditedAt !== undefined) {
    ongoingSessionSync = {...sync, enqueuedAt: coversEditedAt};
    Onyx.merge(ONYXKEYS.ONGOING_SESSION_SYNC, {enqueuedAt: coversEditedAt});
  }
  API.write(
    WRITE_COMMANDS.UPDATE_SESSION,
    {
      sessionId: session.id,
      session,
      sessionIsLive: true,
    },
    coversEditedAt === undefined
      ? {}
      : {
          successData: [
            {
              onyxMethod: Onyx.METHOD.MERGE,
              key: ONYXKEYS.ONGOING_SESSION_SYNC,
              value: {syncedAt: coversEditedAt},
            },
          ],
        },
  );
}

/**
 * Record a local live-session mutation: stamp it as un-synced (so it survives
 * an app kill as "the server never saw this") and (re)arm the debounced
 * persist. Every live mutator funnels through this; `sessionId` is always set
 * when the mutation routed into `ONGOING_SESSION_DATA`, the guard only
 * satisfies the type system.
 */
function recordLiveSessionEdit(sessionId: DrinkingSessionId | undefined): void {
  if (sessionId) {
    markLiveSessionEdited(sessionId);
  }
  scheduleLiveSessionPersist();
}

/**
 * (Re)arm the debounced live-session persist. The caller has already updated
 * `ONGOING_SESSION_DATA` synchronously (instant UI); this only schedules the
 * server write, coalescing a burst of taps into one `UPDATE_SESSION`. The flush
 * runs behind `InteractionManager` so the queue/serialization work never lands
 * on a touch frame.
 */
function scheduleLiveSessionPersist(): void {
  if (liveSessionPersistTimer) {
    clearTimeout(liveSessionPersistTimer);
  }
  liveSessionPersistTimer = setTimeout(() => {
    liveSessionPersistTimer = null;
    let ranSynchronously = false;
    const interaction = InteractionManager.runAfterInteractions(() => {
      ranSynchronously = true;
      liveSessionPersistInteraction = null;
      flushLiveSessionPersist();
    });
    // Store the handle only if the task is still pending. Some environments
    // (tests mock InteractionManager this way) run the task synchronously
    // inside runAfterInteractions; storing the handle then would resurrect a
    // completed task as pending-forever and wedge `hasPendingLiveSessionPersist`.
    if (!ranSynchronously) {
      liveSessionPersistInteraction = interaction;
    }
  }, LIVE_SESSION_PERSIST_DEBOUNCE_MS);
}

/**
 * Check if the current live session data is the same as the one in the database. If not, update the local data.
 *
 * @param ongoingSessionId  The ID of the ongoing session.
 * @param drinkingSessionData  The drinking session data.
 */
async function syncLocalLiveSessionData(
  ongoingSessionId: DrinkingSessionId | undefined | null,
  drinkingSessionData: DrinkingSessionList | undefined | null,
) {
  // No snapshot at all means it simply has not hydrated/loaded yet (cold start,
  // or offline before `app/open` ever ran). That transient must never touch the
  // buffer: clearing it here used to wipe an offline live session's persisted
  // drinks on every cold boot, before the real snapshot arrived. The same goes
  // for the sync stamps: until they hydrate we can't tell whether the buffer
  // holds un-acknowledged offline edits, so no adopt/wipe decision is safe.
  if (!drinkingSessionData || !ongoingSessionSyncLoaded) {
    return;
  }
  if (ongoingSessionId) {
    const newData = drinkingSessionData[ongoingSessionId];
    if (!newData) {
      return;
    }
    // `ONGOING_SESSION_DATA` is the authoritative live-editing buffer on the
    // device that owns the session: its drink taps race ahead of the debounced
    // server echo. While a persist is still pending the buffer is newer than the
    // snapshot we'd adopt here, so overwriting it would roll back just-tapped
    // drinks (and clobber crash-recovered local state). Adopt the snapshot only
    // once this device has nothing un-persisted — that covers cross-device drink
    // updates, cold-start resume and crash recovery without the rollback.
    if (
      hasPendingLiveSessionPersist() &&
      ongoingSessionData?.id === ongoingSessionId &&
      ongoingSessionData?.ongoing
    ) {
      return;
    }
    // Same rule across restarts: the in-memory pending flag dies with the app,
    // but the persisted stamps know the buffer still holds edits no successful
    // request has acknowledged (e.g. everything queued offline). The snapshot
    // can only be older than the buffer then, so adopting it would roll the
    // offline edits back. Once the queued request succeeds, `syncedAt` catches
    // up and the next sync adopts server truth again.
    if (hasUnsyncedLiveSessionEdits(ongoingSessionId)) {
      return;
    }
    await updateLocalData(
      ONYXKEYS.ONGOING_SESSION_DATA,
      newData,
      ongoingSessionId,
    );
  } else {
    // The loaded snapshot shows no ongoing session. Keep the buffer anyway if
    // it holds un-acknowledged local edits (the snapshot may predate an
    // offline-started session whose create is still queued); otherwise clear
    // it, e.g. after the session was finalized on another device.
    if (
      ongoingSessionData?.ongoing &&
      ongoingSessionData.id &&
      hasUnsyncedLiveSessionEdits(ongoingSessionData.id)
    ) {
      return;
    }
    Onyx.set(ONYXKEYS.ONGOING_SESSION_DATA, null);
  }
}

/** Start a live drinking session
 *
 * Assume that if a session is ongoing, it is a live session and its data is stored in the local database.
 *
 * @param user User object
 * @returnsPromise newSessionId Id of the newly started session.
 *  */
async function startLiveDrinkingSession(
  user: User | null,
  timezone: SelectedTimezone | undefined,
): Promise<void> {
  if (!user) {
    throw new Error('Failed to start a live session: User is null');
  }

  const newSessionId = generatePushID();

  // The user is not in an active session
  const newSessionData: DrinkingSession = DSUtils.getEmptySession({
    id: newSessionId,
    type: CONST.SESSION.TYPES.LIVE,
    timezone,
    ongoing: true,
  });

  // The server upserts the session and, because `sessionIsLive`, mirrors it into
  // the user's live status (`user_status`). Live sessions start at "now", so the
  // strict-improvement floor only moves when the user has no earlier session —
  // `sessionUpsertOptimisticData` handles that optimistically.
  API.write(
    WRITE_COMMANDS.UPDATE_SESSION,
    {sessionId: newSessionId, session: newSessionData, sessionIsLive: true},
    {
      optimisticData: sessionUpsertOptimisticData(
        user.uid,
        newSessionId,
        newSessionData,
      ),
    },
  );

  // Fresh session, fresh sync stamps: any leftover marker from a previous
  // (crashed/stale) session must not shadow this one's edits.
  clearLiveSessionSyncState();

  // Seed the synchronous cache so a tap fired before the Onyx.connect callback
  // lands still composes on the new session instead of an empty base.
  DSUtils.setLocalSessionCache(ONYXKEYS.ONGOING_SESSION_DATA, newSessionData);
  await Onyx.set(ONYXKEYS.ONGOING_SESSION_DATA, newSessionData);
}

/** Save final drinking session data to the database
 *
 * @param db Firebase Database object
 * @param string userID User ID
 * @param newSessionData Data to save the new drinking session with
 * @param sesisonKey ID of the session to edit (can be null in case of finishing the session)
 * @returnsPromise void.
 *  */
/**
 * Attach precomputed per-drink local calendar fields (`drinksTimeParts`) to a
 * finalised session so the Statistics cold path reads them with zero `Intl`
 * work. Computed here — at the single save chokepoint, while the user is
 * already interacting — over the session's final timezone and drink timestamps,
 * which is why it transparently picks up timezone changes and date shifts.
 * Returns the session unchanged when there is nothing to store.
 */
function withSessionTimeParts(session: DrinkingSession): DrinkingSession {
  const sessionTz = session.timezone ?? CONST.DEFAULT_TIME_ZONE.selected;
  const drinksTimeParts = buildSessionTimeParts(session.drinks, sessionTz);
  return drinksTimeParts ? {...session, drinksTimeParts} : session;
}

async function saveDrinkingSessionData(
  userID: string,
  newSessionData: DrinkingSession,
  sessionKey: string,
  onyxKey: OnyxKey,
  sessionIsLive?: boolean,
): Promise<void> {
  // This finalize carries the full session and must be the deterministic last
  // writer for it. Cancel any pending debounced live persist, and synchronously
  // drop the cached ongoing copy so a stray tap whose handler runs in this same
  // tick can't re-route into ONGOING_SESSION_DATA and re-create the session.
  // The sync stamps go too: this request carries every local edit itself.
  if (sessionIsLive) {
    cancelLiveSessionPersist();
    DSUtils.clearOngoingSessionCache();
    clearLiveSessionSyncState();
  }

  const sessionToPersist = withSessionTimeParts(newSessionData);
  // The server upserts the session, owns the `earliest_session_at` floor
  // (recomputing it when an edit moves the previously-earliest session later),
  // and — when `sessionIsLive` — updates the user's live status. The optimistic
  // data clean-replaces the cached snapshot so drinks removed during the session
  // don't linger; non-strict floor changes are reconciled by the inline/pushed
  // response.
  API.write(
    WRITE_COMMANDS.UPDATE_SESSION,
    {
      sessionId: sessionKey,
      session: sessionToPersist,
      sessionIsLive: !!sessionIsLive,
    },
    {
      optimisticData: sessionFinalizeOptimisticData(
        userID,
        sessionKey,
        sessionToPersist,
      ),
    },
  );

  await Onyx.set(onyxKey, null);
}

/** Remove drinking session data from the database
 *
 * @param db Firebase Database object
 * @param userID User ID
 * @param sessionKey ID of the session to remove
 * @returns
 *  */
async function removeDrinkingSessionData(
  userID: string,
  sessionKey: string,
  onyxKey: OnyxKey,
  sessionIsLive?: boolean,
): Promise<void> {
  // This delete must be the deterministic last writer for the session. Cancel any
  // pending debounced live persist, and synchronously drop the cached ongoing
  // copy so a stray tap landing in this same tick can't re-create the session.
  // The sync stamps go too: there is nothing left to persist.
  if (sessionIsLive) {
    cancelLiveSessionPersist();
    DSUtils.clearOngoingSessionCache();
    clearLiveSessionSyncState();
  }

  // The server removes the session and its GPS locations, recomputes the
  // `earliest_session_at` floor, and — when `sessionIsLive` — clears the user's
  // live status. The optimistic data removes the session from the cached
  // snapshot; the new floor is reconciled by the inline/pushed response.
  API.write(
    WRITE_COMMANDS.DELETE_SESSION,
    {sessionId: sessionKey, sessionIsLive: !!sessionIsLive},
    {optimisticData: [cachedSessionPatch(userID, sessionKey, null)]},
  );

  await Onyx.set(onyxKey, null);
  await Onyx.set(`${ONYXKEYS.COLLECTION.SESSION_LOCATIONS}${sessionKey}`, null);
}

/**
 * Update the drinks list in a drinking session. Perform the changes locally and update the Onyx store.
 *
 * @param sessionId ID of the session to update.
 * @param drinks The drinks to add or remove.
 * @param drinksToUnits Drink to units mapping.
 * @param action The action to perform (i.e., add, remove,...).
 * @returns For ADD actions, the timestamp under which the drink was recorded
 *   when the count for this drink actually grew (so callers like the
 *   location-capture path don't fire for adds rejected by the max-units
 *   guard). Undefined for REMOVE or when nothing changed.
 */
function updateDrinks(
  sessionId: DrinkingSessionId | undefined,
  drinkKey: DrinkKey,
  amount: number,
  action: ValueOf<typeof CONST.DRINKS.ACTIONS>,
  drinksToUnits: DrinksToUnits | undefined,
): DrinksTimestamp | undefined {
  if (!drinksToUnits || !sessionId) {
    return undefined;
  }
  const session = DSUtils.getDrinkingSessionData(sessionId);
  const onyxKey = DSUtils.getDrinkingSessionOnyxKey(sessionId);
  if (!session || !onyxKey) {
    return undefined;
  }
  const previousDrinks = session.drinks ?? {};
  const drinksList = DSUtils.modifySessionDrinks(
    session,
    drinkKey,
    amount,
    action,
    drinksToUnits,
  );

  // Compose on the freshest value: update the cached copy synchronously so a
  // rapid follow-up mutation (e.g. a remove tapped right after several adds)
  // composes on the latest drinks instead of the stale Onyx.connect snapshot,
  // which lags while the JS thread is busy persisting. Without this the remove's
  // `Onyx.set` below wipes adds that haven't propagated back to the cache yet.
  const updatedSession: DrinkingSession = {...session, drinks: drinksList};
  DSUtils.setLocalSessionCache(onyxKey, updatedSession);

  // Merge can only be used when adding drinks, or when removing drinks does not delete the drink key
  if (action === CONST.DRINKS.ACTIONS.ADD) {
    Onyx.merge(onyxKey, {
      drinks: drinksList,
    });
  } else {
    Onyx.set(onyxKey, updatedSession);
  }

  // Live (ongoing) sessions sync to the server through the debounced action-layer
  // persist; edit sessions persist only on save, so don't schedule for them.
  if (onyxKey === ONYXKEYS.ONGOING_SESSION_DATA) {
    recordLiveSessionEdit(sessionId);
  }

  if (action !== CONST.DRINKS.ACTIONS.ADD || !drinksList) {
    return undefined;
  }
  // Find the latest timestamp whose count for this drink actually increased.
  // Skips the no-op case where addDrinksToList rejected the add (max units).
  let added: DrinksTimestamp | undefined;
  for (const timestampStr of Object.keys(drinksList)) {
    const timestamp = Number(timestampStr);
    const newCount = drinksList[timestamp]?.[drinkKey] ?? 0;
    const oldCount = previousDrinks[timestamp]?.[drinkKey] ?? 0;
    if (newCount > oldCount && (added === undefined || timestamp > added)) {
      added = timestamp;
    }
  }
  return added;
}

/**
 * Update a drinking session note
 *
 * @param session The session to update
 * @param newNote The new note
 * @returns void
 */
function updateNote(
  session: DrinkingSession | undefined,
  newNote: string,
): void {
  const onyxKey = DSUtils.getDrinkingSessionOnyxKey(session?.id);
  if (onyxKey) {
    const current = DSUtils.getDrinkingSessionData(session?.id) ?? session;
    Onyx.merge(onyxKey, {
      note: newNote,
    });
    if (current) {
      DSUtils.setLocalSessionCache(onyxKey, {...current, note: newNote});
    }
    if (onyxKey === ONYXKEYS.ONGOING_SESSION_DATA) {
      recordLiveSessionEdit(current?.id ?? session?.id);
    }
  }
}

function updateBlackout(
  session: DrinkingSession | undefined,
  blackout: boolean,
): void {
  const onyxKey = DSUtils.getDrinkingSessionOnyxKey(session?.id);
  if (onyxKey) {
    const current = DSUtils.getDrinkingSessionData(session?.id) ?? session;
    Onyx.merge(onyxKey, {
      blackout,
    });
    if (current) {
      DSUtils.setLocalSessionCache(onyxKey, {...current, blackout});
    }
    if (onyxKey === ONYXKEYS.ONGOING_SESSION_DATA) {
      recordLiveSessionEdit(current?.id ?? session?.id);
    }
  }
}

/**
 * Update a drinking session timezone
 *
 * @param session The session to update
 * @param newTimezone The new timezone
 * @returns void
 */
function updateTimezone(
  session: DrinkingSession | undefined,
  newTimezone: SelectedTimezone,
): void {
  const onyxKey = DSUtils.getDrinkingSessionOnyxKey(session?.id);
  if (onyxKey) {
    const current = DSUtils.getDrinkingSessionData(session?.id) ?? session;
    Onyx.merge(onyxKey, {
      timezone: newTimezone,
    });
    if (current) {
      DSUtils.setLocalSessionCache(onyxKey, {
        ...current,
        timezone: newTimezone,
      });
    }
    if (onyxKey === ONYXKEYS.ONGOING_SESSION_DATA) {
      recordLiveSessionEdit(current?.id ?? session?.id);
    }
  }
}

/**
 * Change all timestamps in a session so that its start time corresponds to a new date.
 *
 * Shift the timestamps by whole days, keeping the hour:minute times as they are.
 *
 * @param sessionId The ID of the session to modify
 * @param session The session to modify
 * @param newDate The new date to modify the session's timestamps to
 * @param shouldUpdateLiveSessionData Whether to update the live session data or not. If not specified, the function updates the edit session data.
 * @returns The modified session
 */
async function updateSessionDate(
  sessionId: DrinkingSessionId,
  session: DrinkingSession,
  newDate: Date,
  shouldUpdateLiveSessionData?: boolean,
): Promise<void> {
  // Resolve the day shift in the session's own timezone, not the device's.
  // `newDate` carries the picked calendar day in its local fields; `currentDay`
  // re-expresses the session start in the same frame so the difference is the
  // number of calendar days the user actually moved, even when the device tz
  // differs from the session tz.
  const sessionTimezone = session.timezone ?? CONST.DEFAULT_TIME_ZONE.selected;
  const currentDay = toZonedTime(session.start_time, sessionTimezone);
  const daysDelta = differenceInCalendarDays(currentDay, newDate);
  const millisecondsToSub = daysDelta * 24 * 60 * 60 * 1000;
  const modifiedSession = DSUtils.shiftSessionTimestamps(
    session,
    millisecondsToSub,
  );
  const onyxKey = shouldUpdateLiveSessionData
    ? ONYXKEYS.ONGOING_SESSION_DATA
    : ONYXKEYS.EDIT_SESSION_DATA;
  await updateLocalData(onyxKey, modifiedSession, sessionId);
  if (shouldUpdateLiveSessionData) {
    recordLiveSessionEdit(sessionId);
  }
}

/** Generate a new key for a drinking session */
function generateDrinkingSessionId(user: User | null): DrinkingSessionId {
  if (!user) {
    throw new Error(Localize.translateLocal('common.error.userNull'));
  }
  return generatePushID();
}

async function getNewSessionToEdit(
  user: User | null,
  currentDate: Date,
  timezone: SelectedTimezone | undefined,
  shouldUpdateLocalData = true,
): Promise<DrinkingSession> {
  if (!user) {
    throw new Error('User is null when trying to create a new session');
  }
  const newSessionId = generateDrinkingSessionId(user);
  const timestamp = currentDate.getTime();
  const newSession: DrinkingSession = DSUtils.getEmptySession({
    id: newSessionId,
    start_time: timestamp,
    end_time: timestamp,
    type: CONST.SESSION.TYPES.EDIT,
    timezone,
  });

  if (shouldUpdateLocalData) {
    await updateLocalData(ONYXKEYS.EDIT_SESSION_DATA, newSession, newSessionId);
  }

  return newSession;
}

/** Set a value under the isCreatingNewSession onyx key */
async function setIsCreatingNewSession(val: boolean): Promise<void> {
  await Onyx.merge(ONYXKEYS.IS_CREATING_NEW_SESSION, val);
}

/**
 * Navigate to the an ongoing session screen
 *
 * Assume the session data is correctly synced with the local ongoingSessionData Onyx object
 *
 * @param sessionId ID of the session to navigate to
 * @param session Current session data
 */
function navigateToOngoingSessionScreen(): void {
  if (!ongoingSessionData?.id) {
    Alert.alert(Localize.translateLocal('drinkingSession.error.missingId'));
    return;
  }
  Navigation.navigate(
    ROUTES.DRINKING_SESSION_LIVE.getRoute(ongoingSessionData.id),
  );
}

async function updateLocalSessionDataAndNavigate(
  sessionId: DrinkingSessionId | undefined,
  session: DrinkingSession | undefined,
  onyxKey: OnyxKey,
  route: Route,
): Promise<void> {
  if (!sessionId) {
    throw new Error(Localize.translateLocal('drinkingSession.error.missingId'));
  }
  if (session) {
    await updateLocalData(onyxKey, session, sessionId);
  }
  Navigation.navigate(route);
}

/**
 * Navigate to the edit session screen. If the session object is provided, update the local data before navigating.
 *
 * @param sessionId ID of the session to navigate to
 * @param session Current session data
 */
async function navigateToEditSessionScreen(
  sessionId: DrinkingSessionId | undefined,
  session?: DrinkingSession,
  backTo?: Route,
): Promise<void> {
  if (!sessionId) {
    throw new Error(Localize.translateLocal('drinkingSession.error.missingId'));
  }

  await updateLocalSessionDataAndNavigate(
    sessionId,
    session,
    ONYXKEYS.EDIT_SESSION_DATA,
    ROUTES.DRINKING_SESSION_EDIT.getRoute(sessionId, backTo),
  );
}

/**
 * Read a FRIEND's drinking sessions, windowed by `start_time` (`>= from`), via
 * the privacy-enforced `GET /v1/users/:uid/sessions` endpoint. This replaces the
 * client's direct, unguarded Firebase RTDB `get()` of `user_drinking_sessions/$uid`:
 * the API now enforces the friends + visibility check that used to live only in
 * the RTDB security rules (which the admin SDK bypasses).
 *
 * The server returns the windowed map as onyxData merged under
 * `cachedDrinkingSessions[userID]`. A denied / hidden read returns an EVICTION
 * (that key set to `null`) so a viewer who has lost access stops showing the
 * sessions they cached while previously allowed (Kiroku #786). Both flow through
 * the standard `SaveResponseInOnyx` pipeline; this returns the promise so the
 * fetch hook can clear its own loading state once the round-trip settles.
 */
function openFriendDrinkingSessions(
  userID: UserID,
  from: number,
): Promise<void | Response> {
  const parameters: OpenFriendDrinkingSessionsParams = {userID, from};
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  return API.makeRequestWithSideEffects(
    READ_COMMANDS.OPEN_FRIEND_DRINKING_SESSIONS,
    parameters,
    {},
    CONST.API_REQUEST_TYPE.READ,
  );
}

export {
  generateDrinkingSessionId,
  openFriendDrinkingSessions,
  navigateToEditSessionScreen,
  navigateToOngoingSessionScreen,
  removeDrinkingSessionData,
  saveDrinkingSessionData,
  setIsCreatingNewSession,
  startLiveDrinkingSession,
  syncLocalLiveSessionData,
  updateBlackout,
  updateDrinks,
  updateNote,
  updateLocalData,
  updateLocalSessionDataAndNavigate,
  updateSessionDate,
  updateTimezone,
  getNewSessionToEdit,
};
