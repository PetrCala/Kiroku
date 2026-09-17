import type {
  DrinkingSession,
  DrinkingSessionId,
  DrinkingSessionList,
  DrinkKey,
  DrinksToUnits,
  DrinksTimestamp,
  OngoingSessionSync,
  SessionEntrySource,
  SessionVisibility,
  UnsyncedSessionWriteList,
  UserDataList,
  UserDrinkingSessionsList,
} from '@src/types/onyx';
import Log from '@libs/Log';
import * as Localize from '@libs/Localize';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import type {AddEntryOverrides} from '@libs/DrinkingSessionUtils';
import * as FeatureFlags from '@libs/FeatureFlags';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import getPlatform from '@libs/getPlatform';
import {isSchemaV2Session} from '@libs/SessionEntries';
import {
  buildEntryPatchOps,
  buildSessionDiffOps,
  buildSetBlackoutOp,
  buildSetNoteOp,
} from '@libs/SessionOpBuilders';
import type {
  PendingSessionOp,
  SessionDiffOptions,
  SessionPatch,
} from '@libs/SessionOpBuilders';
import {getDefaultSessionName} from '@libs/SessionName';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {SessionEntryId} from '@src/types/onyx/SessionEntries';
import type SessionEntries from '@src/types/onyx/SessionEntries';
import DateUtils from '@libs/DateUtils';
import type {User} from 'firebase/auth';
import CONST from '@src/CONST';
import generatePushID from '@libs/generatePushID';
import Onyx from 'react-native-onyx';
import type {OnyxKey as OnyxStoreKey, OnyxUpdate} from 'react-native-onyx';
import * as API from '@libs/API';
import {buildSessionTimeParts} from '@libs/Statistics/sessionTimeParts';
import {READ_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
import type Response from '@src/types/onyx/Response';
import type {OnyxData} from '@src/types/onyx/Request';
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
import * as PersistedRequests from './PersistedRequests';
import {sendSessionOp} from './SessionOps';

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
    ongoingSessionSyncLoaded = true;
    // A live flush that resolves after finalize/discard cleared the stamps
    // merges only its own fields back (`syncedAt` on success, the drop
    // bookkeeping on a rejection): a queued request cannot know the marker is
    // gone. Such a fragment names no session, so nothing can act on it; drop
    // it rather than let it linger. Unless a newer edit has already re-stamped
    // the key, in which case this callback is the stale one and the edit's
    // own write supersedes the fragment.
    if (value && !value.sessionId) {
      if (!ongoingSessionSync?.sessionId) {
        Onyx.set(ONYXKEYS.ONGOING_SESSION_SYNC, null);
      }
      return;
    }
    ongoingSessionSync = value ?? undefined;
    maybeResumeLiveSessionPersist();
  },
});

// Parked finalize writes (see `UNSYNCED_SESSION_WRITES`): kept in a module
// cache so the one-shot boot re-send below can read them without a React
// context, same pattern as the sync marker above.
let unsyncedSessionWrites: UnsyncedSessionWriteList | undefined;
let hasProcessedInitialUnsyncedWrites = false;
// eslint-disable-next-line rulesdir/no-onyx-connect -- module-scope action-layer wiring with no React context to hang a useOnyx on, same as the sync-marker connection above
Onyx.connect({
  key: ONYXKEYS.UNSYNCED_SESSION_WRITES,
  callback: value => {
    unsyncedSessionWrites = value ?? undefined;
    // Re-enqueue parked writes exactly once per app run, on first hydration.
    // Entries parked later in THIS run are deliberately left alone until the
    // next run: the server just deterministically rejected them, so an
    // immediate replay would only fail again.
    if (!hasProcessedInitialUnsyncedWrites) {
      hasProcessedInitialUnsyncedWrites = true;
      resendUnsyncedSessionWrites();
    }
  },
});

/**
 * Re-enqueue every parked session write (a finalize the request queue
 * permanently dropped in an earlier run; see `saveDrinkingSessionData`). The
 * optimistic data resurfaces the session in the cached snapshot, and only a
 * successful delivery clears the parked entry, so the payload survives any
 * number of further failed runs.
 */
function resendUnsyncedSessionWrites(): void {
  const entries = Object.values(unsyncedSessionWrites ?? {});
  if (entries.length === 0) {
    return;
  }
  Log.hmmm('[DrinkingSession] Re-enqueueing parked session writes', {
    count: entries.length,
  });
  entries.forEach(entry => {
    API.write(
      WRITE_COMMANDS.UPDATE_SESSION,
      {
        sessionId: entry.sessionId,
        session: entry.session,
        sessionIsLive: entry.sessionIsLive,
      },
      {
        optimisticData: cachedSessionReplace(
          entry.userID,
          entry.sessionId,
          entry.session,
        ),
        successData: [
          {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.UNSYNCED_SESSION_WRITES,
            value: {[entry.sessionId]: null},
          },
        ],
      },
    );
  });
}

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

// The cached snapshot of what the server last said each session looks like.
// The op path diffs a save against it (see `saveSessionThroughOps`), which
// needs it synchronously at save time, with no React context to hang a
// `useOnyx` on.
let cachedSessions: UserDrinkingSessionsList | undefined;
// eslint-disable-next-line rulesdir/no-onyx-connect -- module-scope action-layer wiring; a save needs this synchronously and has no React context to hang a useOnyx on, same as the connections above
Onyx.connect({
  key: ONYXKEYS.CACHED_DRINKING_SESSIONS,
  callback: value => {
    cachedSessions = value ?? undefined;
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
// How many consecutive permanent drops of an enqueued live flush (deterministic
// server rejections) the automatic re-arm tolerates at full speed (one
// debounce window apart). Past that it keeps re-arming, but only once per
// cooldown that doubles from `LIVE_FLUSH_DROP_COOLDOWN_MS` up to
// `LIVE_FLUSH_DROP_COOLDOWN_MAX_MS`, so a payload the server always rejects
// costs one request every few minutes rather than a tight loop, while a
// rejection that clears (a server-side fix, a deploy) is picked up without
// waiting for the user's next edit. See `maybeResumeLiveSessionPersist`.
const MAX_LIVE_FLUSH_DROPS = 3;
let liveSessionPersistTimer: ReturnType<typeof setTimeout> | null = null;
let liveSessionPersistInteraction: {cancel: () => void} | null = null;
// Armed while the re-arm is in its slow phase (see above): fires one
// `scheduleLiveSessionPersist` after the cooldown.
let liveFlushCooldownTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Whether a debounced live-session persist is armed or deferred but not yet sent.
 * While true this device has un-persisted live edits, so the cached snapshot lags
 * the local `ONGOING_SESSION_DATA` buffer — `syncLocalLiveSessionData` uses this
 * to avoid rolling the buffer back to the (older) snapshot.
 */
function hasPendingLiveSessionPersist(): boolean {
  return (
    liveSessionPersistTimer !== null ||
    liveSessionPersistInteraction !== null ||
    liveFlushCooldownTimer !== null
  );
}

/** Cancel a cooldown re-arm (see `maybeResumeLiveSessionPersist`), if any. */
function cancelLiveFlushCooldown(): void {
  if (liveFlushCooldownTimer) {
    clearTimeout(liveFlushCooldownTimer);
    liveFlushCooldownTimer = null;
  }
}

/** Cancel a scheduled-but-not-yet-sent debounced live-session persist. */
function cancelLiveSessionPersist(): void {
  cancelLiveFlushCooldown();
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
  // A new edit is a new payload: it gets a fresh drop budget (see
  // `maybeResumeLiveSessionPersist`).
  delete next.flushDropCount;
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
  // The request queue permanently dropped this payload several times in a row
  // (deterministic server rejections; transient failures never drop). Keep
  // re-arming, but slowly: one flush per cooldown, doubling with every further
  // drop. The buffer stays guarded locally meanwhile (`syncedAt` never
  // advanced), and the next explicit edit resets the count, so a fresh payload
  // goes out at full speed again.
  const flushDropCount = sync.flushDropCount ?? 0;
  if (flushDropCount >= MAX_LIVE_FLUSH_DROPS) {
    const cooldownMs = Math.min(
      CONST.NETWORK.LIVE_FLUSH_DROP_COOLDOWN_MS *
        2 ** (flushDropCount - MAX_LIVE_FLUSH_DROPS),
      CONST.NETWORK.LIVE_FLUSH_DROP_COOLDOWN_MAX_MS,
    );
    Log.hmmm(
      '[DrinkingSession] Live flush dropped too many times; re-arming after a cooldown',
      {sessionId: session.id, flushDropCount, cooldownMs},
    );
    liveFlushCooldownTimer = setTimeout(() => {
      liveFlushCooldownTimer = null;
      scheduleLiveSessionPersist();
    }, cooldownMs);
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
          // Applied only if the request queue permanently drops this request
          // (a deterministic server rejection; transient
          // failures are never dropped). Clearing `enqueuedAt` re-opens the
          // "never reached the queue" state, so the next hydration or edit
          // re-arms the persist and the following full-session flush re-sends
          // everything; `flushDropCount` slows that loop down (see
          // `maybeResumeLiveSessionPersist`).
          failureData: [
            {
              onyxMethod: Onyx.METHOD.MERGE,
              key: ONYXKEYS.ONGOING_SESSION_SYNC,
              value: {
                enqueuedAt: null,
                flushDropCount: (sync?.flushDropCount ?? 0) + 1,
              },
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
  // A persist scheduled now supersedes a slow re-arm still waiting its turn.
  cancelLiveFlushCooldown();
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
    // On the op path the exact answer is in the queue itself: while this
    // device has ops for the session waiting there, the local buffer is ahead
    // of the snapshot and adopting the snapshot would roll just-tapped drinks
    // back. That covers the restart case too, because the queue is persisted,
    // which is why the op path needs no sync stamps at all.
    if (
      shouldUseSessionOps(ongoingSessionData) &&
      ongoingSessionData?.id === ongoingSessionId
    ) {
      if (hasQueuedSessionOps(ongoingSessionId)) {
        return;
      }
      await updateLocalData(
        ONYXKEYS.ONGOING_SESSION_DATA,
        newData,
        ongoingSessionId,
      );
      return;
    }
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
      (shouldUseSessionOps(ongoingSessionData)
        ? hasQueuedSessionOps(ongoingSessionData.id)
        : hasUnsyncedLiveSessionEdits(ongoingSessionData.id))
    ) {
      return;
    }
    Onyx.set(ONYXKEYS.ONGOING_SESSION_DATA, null);
  }
}

/**
 * Whether new sessions are written as Sessions v2 (`schema_version: 2`, a
 * default name, `visibility`, drinks as `entries`). Behind a flag until the
 * backfill has run and the server accepts schema 2 (Kiroku#1664).
 */
function shouldWriteSchemaV2(): boolean {
  return FeatureFlags.isEnabled('SESSIONS_V2_SCHEMA');
}

/**
 * The Sessions v2 meta a new session starts with (RFC §4.2): the schema
 * marker, the auto-generated default name for its start time and timezone
 * (RFC §9), and `friends` visibility. Applied only when the flag is on.
 */
function withSchemaV2Meta(session: DrinkingSession): DrinkingSession {
  if (!shouldWriteSchemaV2()) {
    return session;
  }
  return {
    ...session,
    schema_version: CONST.SESSION.SCHEMA_VERSION,
    name: getDefaultSessionName(session.start_time, session.timezone),
    visibility: CONST.SESSION.VISIBILITY.FRIENDS,
  };
}

/** Where a drink logged on this device comes from (RFC §4.3 `source`). */
function getEntrySource(): SessionEntrySource {
  return getPlatform() === CONST.PLATFORM.WEB
    ? CONST.SESSION.ENTRY_SOURCE.WEB
    : CONST.SESSION.ENTRY_SOURCE.PHONE;
}

/**
 * Whether this session's writes go out as ops (Sessions v2 RFC §5.6) rather
 * than as whole-session upserts.
 *
 * Both conditions are load-bearing. The flag is the kill switch: turning it
 * off has to put every write back on the snapshot path, so that path stays in
 * place until the flag goes away for good. And a LEGACY session never goes
 * through ops even with the flag on: its drinks live in `drinks` buckets,
 * which have no entry ids for an op to name, and the server refuses an op
 * against one. Such a session keeps writing whole until the W1 backfill
 * converts it.
 */
function shouldUseSessionOps(
  session: DrinkingSession | undefined | null,
): boolean {
  return (
    FeatureFlags.isEnabled('SESSION_OPS') &&
    !!session &&
    isSchemaV2Session(session)
  );
}

/**
 * Turns an op's patch into the Onyx update that applies it. Each target key
 * has its own applier because a session sits at the root of the live editing
 * buffer but under `{uid: {sessionId: ...}}` in the cached snapshot.
 */
type PatchApplier = (patch: SessionPatch) => OnyxUpdate;

/** Applier for the live editing buffer. */
function liveBufferApplier(): PatchApplier {
  return patch => ({
    onyxMethod: Onyx.METHOD.MERGE,
    key: ONYXKEYS.ONGOING_SESSION_DATA,
    value: patch,
  });
}

/** Applier for the cached snapshot of one user's session. */
function cachedSessionApplier(
  uid: UserID,
  sessionId: DrinkingSessionId,
): PatchApplier {
  return patch => ({
    onyxMethod: Onyx.METHOD.MERGE,
    key: ONYXKEYS.CACHED_DRINKING_SESSIONS,
    value: {[uid]: {[sessionId]: patch}},
  });
}

/**
 * Send a list of ops, each with its own optimistic and failure data (RFC
 * §5.3). `API.write` puts every op in the persisted queue synchronously, so an
 * app killed mid-session leaves its ops queued and they drain on the next
 * launch. That is what replaces the debounced whole-session persist: a burst
 * of taps coalesces in the queue's conflict resolver
 * (`SessionOps.coalesceWithLatestSessionOp`) rather than behind a timer, and
 * nothing has to remember that the local buffer holds edits the server has
 * never seen.
 *
 * One op's rejection rolls back only that op's change: the ops of a save are
 * independent, so a refused `add_entry` must not undo the note that saved
 * alongside it.
 */
function sendSessionOps(
  ops: PendingSessionOp[],
  sessionId: DrinkingSessionId,
  apply: PatchApplier,
): void {
  ops.forEach(op => {
    const onyxData: OnyxData = {};
    if (Object.keys(op.patch).length > 0) {
      onyxData.optimisticData = [apply(op.patch)];
    }
    if (Object.keys(op.undo).length > 0) {
      onyxData.failureData = [apply(op.undo)];
    }
    sendSessionOp({sessionId, type: op.type, payload: op.payload}, onyxData);
  });
}

/**
 * Send one meta op for a LIVE session, if this session writes through ops.
 * Returns whether it did, so the caller can fall through to the snapshot path
 * when it did not.
 */
function sendLiveMetaOp(
  session: DrinkingSession | undefined,
  op: PendingSessionOp,
): boolean {
  if (!session?.id || !shouldUseSessionOps(session)) {
    return false;
  }
  sendSessionOps([op], session.id, liveBufferApplier());
  return true;
}

/**
 * Send the ops for the difference between two versions of a LIVE session.
 * Returns whether it did, so the caller can fall through to the snapshot path.
 */
function sendLiveSessionDiff(
  stored: DrinkingSession,
  edited: DrinkingSession,
  options: SessionDiffOptions,
): boolean {
  if (!stored.id || !shouldUseSessionOps(stored)) {
    return false;
  }
  sendSessionOps(
    buildSessionDiffOps(stored, edited, options),
    stored.id,
    liveBufferApplier(),
  );
  return true;
}

/**
 * Whether this device still has ops for `sessionId` waiting in the persisted
 * queue. The op-path answer to "does the local copy hold changes the server
 * has not acknowledged?", and a better one than the sync stamps the snapshot
 * path keeps: it reads the queue itself, so it is exact, and the queue is
 * persisted, so it survives a restart.
 */
function hasQueuedSessionOps(sessionId: DrinkingSessionId): boolean {
  return PersistedRequests.getAll().some(
    request =>
      request.command === WRITE_COMMANDS.SESSION_OP &&
      (request.data as {sessionId?: string} | undefined)?.sessionId ===
        sessionId,
  );
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
  const newSessionData: DrinkingSession = withSchemaV2Meta(
    DSUtils.getEmptySession({
      id: newSessionId,
      type: CONST.SESSION.TYPES.LIVE,
      timezone,
      ongoing: true,
    }),
  );

  if (shouldUseSessionOps(newSessionData)) {
    // One `start` op carries the whole of a new session's meta, and the server
    // creates it, claims the live `user_status` slot and lowers the
    // earliest-session floor in one multi-path update.
    sendSessionOps(
      buildSessionDiffOps(undefined, newSessionData),
      newSessionId,
      cachedSessionApplier(user.uid, newSessionId),
    );
    // The `start` op carries no patch of its own (the server writes the
    // session), so the cached snapshot gets its optimistic copy here, the same
    // one the snapshot path writes.
    Onyx.update(
      sessionUpsertOptimisticData(user.uid, newSessionId, newSessionData),
    );
  } else {
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
  }

  // Fresh session, fresh sync stamps: any leftover marker from a previous
  // (crashed/stale) session must not shadow this one's edits. Harmless on the
  // op path, which keeps no stamps, and required when the flag is off.
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
  const drinksTimeParts = buildSessionTimeParts(session, sessionTz);
  return drinksTimeParts ? {...session, drinksTimeParts} : session;
}

/**
 * Save a session by sending the ops for what actually changed, instead of one
 * whole-session upsert (RFC §5.6).
 *
 * The baseline is the cached snapshot, which is what the server last told us
 * this session looks like.
 *
 * - A **live** session is diffed on its META only, plus `end`. Every entry
 *   change was already sent as its own op while the session ran, so diffing
 *   entries again against a snapshot that may lag the queue would resend ops
 *   that already landed. Meta ops are absolute, so a redundant one is
 *   harmless.
 * - An **edit** session is diffed in full, entries included: its mutations
 *   stayed local until this moment, so the snapshot is an exact baseline and
 *   nothing about it can lag.
 * - A session the server has never seen (a new session from the edit flow)
 *   becomes one `start` carrying all of its meta plus an `add_entry` per
 *   drink. `start` stamps `ongoing` from the session's own type, so an edit
 *   session arrives closed and needs no `end`.
 *
 * `drinksTimeParts` is deliberately not sent. It is a client-computed `Intl`
 * cache; the Statistics read path recomputes any timestamp missing from it and
 * its backfill regenerates the map, so an op-written session is correct and
 * pays the cold-path cost once.
 */
function saveSessionThroughOps(
  userID: UserID,
  newSessionData: DrinkingSession,
  sessionKey: DrinkingSessionId,
  sessionIsLive: boolean,
): void {
  const stored = cachedSessions?.[userID]?.[sessionKey];
  const ops = buildSessionDiffOps(stored, newSessionData, {
    shouldIncludeEntries: !sessionIsLive,
  });
  // A live session's `end` only fires when the snapshot still says the session
  // is ongoing. When the snapshot lags (its `ongoing` is already false, or the
  // session is missing from it), the diff would drop the close, so add it.
  if (sessionIsLive && !ops.some(op => op.type === CONST.SESSION_OP.TYPE.END)) {
    ops.push({
      type: CONST.SESSION_OP.TYPE.END,
      payload: {end_time: newSessionData.end_time},
      patch: {ongoing: false, end_time: newSessionData.end_time},
      undo: {},
    });
  }
  sendSessionOps(ops, sessionKey, cachedSessionApplier(userID, sessionKey));
  // The ops' own patches cover what each of them changed; this puts the whole
  // saved session in the cached snapshot at once, so the summary screen the
  // user lands on reads the session rather than waiting for the round trips.
  Onyx.update(
    sessionFinalizeOptimisticData(userID, sessionKey, newSessionData),
  );
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

  if (shouldUseSessionOps(newSessionData)) {
    saveSessionThroughOps(userID, newSessionData, sessionKey, !!sessionIsLive);
    await Onyx.set(onyxKey, null);
    return;
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
      // Applied only if the request queue permanently drops this request (a
      // deterministic server rejection; transient failures are
      // never dropped). Nothing later re-sends a finalize, so park the full
      // payload; the next app run re-enqueues it once
      // (`resendUnsyncedSessionWrites`) and a successful delivery clears it.
      failureData: [
        {
          onyxMethod: Onyx.METHOD.MERGE,
          key: ONYXKEYS.UNSYNCED_SESSION_WRITES,
          value: {
            [sessionKey]: {
              sessionId: sessionKey,
              session: sessionToPersist,
              userID,
              sessionIsLive: !!sessionIsLive,
              enqueuedAt: Date.now(),
            },
          },
        },
      ],
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
  if (isSchemaV2Session(session)) {
    return updateEntries(
      session,
      onyxKey,
      drinkKey,
      amount,
      action,
      drinksToUnits,
    );
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
 * The Sessions v2 half of `updateDrinks`: change the session's entries and
 * merge only the changed ones into Onyx (an add appends one entry, a remove
 * tombstones or reduces existing ones; keys are never removed). Same cache,
 * persist and return contract as the legacy path.
 */
function updateEntries(
  session: DrinkingSession,
  onyxKey: OnyxStoreKey,
  drinkKey: DrinkKey,
  amount: number,
  action: ValueOf<typeof CONST.DRINKS.ACTIONS>,
  drinksToUnits: DrinksToUnits,
  overrides: AddEntryOverrides = {},
): DrinksTimestamp | undefined {
  const authorUid = getFirebaseAuth().currentUser?.uid;
  if (!authorUid) {
    Log.warn('updateDrinks: no signed-in user to author the entry');
    return undefined;
  }
  const {patch, addedTs} = DSUtils.modifySessionEntries(
    session,
    drinkKey,
    amount,
    action,
    drinksToUnits,
    authorUid,
    getEntrySource(),
    generatePushID,
    overrides,
  );
  return applyEntriesPatch(session, onyxKey, patch) ? addedTs : undefined;
}

/**
 * Persist a change to a session's entries: the one place every entry mutation
 * (a tap, a preset add, a retro-add, a per-entry edit, a delete) goes through.
 *
 * A live session's entries go out as ops, one per changed entry: an add
 * appends, a removal that empties an entry tombstones it, one that only
 * reduces it edits its count. Each op carries its patch as optimistic data, so
 * the change shows instantly and a rejection undoes exactly that entry. An
 * edit session stays local until it is saved, as it always has, and
 * `saveDrinkingSessionData` diffs it into ops then.
 *
 * Returns whether anything changed.
 */
function applyEntriesPatch(
  session: DrinkingSession,
  onyxKey: OnyxStoreKey,
  patch: SessionEntries,
): boolean {
  if (Object.keys(patch).length === 0) {
    return false;
  }
  // Compose the next mutation on the freshest value, not on a lagging
  // Onyx.connect snapshot: the cache is read synchronously by the next tap.
  DSUtils.setLocalSessionCache(onyxKey, {
    ...session,
    entries: {...session.entries, ...patch},
  });

  if (
    onyxKey === ONYXKEYS.ONGOING_SESSION_DATA &&
    session.id &&
    shouldUseSessionOps(session)
  ) {
    sendSessionOps(
      buildEntryPatchOps(session.entries, patch),
      session.id,
      liveBufferApplier(),
    );
    return true;
  }

  Onyx.merge(onyxKey, {entries: patch});
  if (onyxKey === ONYXKEYS.ONGOING_SESSION_DATA) {
    recordLiveSessionEdit(session.id);
  }
  return true;
}

/** The session and the Onyx key it is being edited under, or `undefined`. */
function resolveEntryTarget(sessionId: DrinkingSessionId | undefined):
  | {
      session: DrinkingSession;
      onyxKey: OnyxStoreKey;
      sessionId: DrinkingSessionId;
    }
  | undefined {
  const session = DSUtils.getDrinkingSessionData(sessionId);
  const onyxKey = DSUtils.getDrinkingSessionOnyxKey(sessionId);
  if (!session || !onyxKey || !sessionId) {
    return undefined;
  }
  if (!isSchemaV2Session(session)) {
    Log.warn(
      '[DrinkingSession] Entry-targeted writes need a schema 2 session',
      {sessionId},
    );
    return undefined;
  }
  return {session, onyxKey, sessionId};
}

/**
 * Add ONE entry, naming the serving and the time it happened: the capture
 * UI's preset add and retro-add ("this beer was 20 minutes ago").
 *
 * `updateDrinks` is still the plain "+1 of this type" path and goes through
 * the same code; this exists so the UI can say which serving and which moment
 * without the caller having to reach into the utils.
 *
 * Returns the new entry's id and time, which the caller needs to offer undo.
 */
function addSessionEntry(
  sessionId: DrinkingSessionId | undefined,
  options: {
    drinkKey: DrinkKey;
    amount?: number;
    drinksToUnits: DrinksToUnits | undefined;
  } & AddEntryOverrides,
): {entryId: SessionEntryId; ts: number} | undefined {
  const target = resolveEntryTarget(sessionId);
  const authorUid = getFirebaseAuth().currentUser?.uid;
  if (!target || !authorUid || !options.drinksToUnits) {
    return undefined;
  }
  const {ts: overrideTs, volume_ml: volumeMl, abv} = options;
  const {patch, addedTs} = DSUtils.modifySessionEntries(
    target.session,
    options.drinkKey,
    options.amount ?? 1,
    CONST.DRINKS.ACTIONS.ADD,
    options.drinksToUnits,
    authorUid,
    getEntrySource(),
    generatePushID,
    {ts: overrideTs, volume_ml: volumeMl, abv},
  );
  const [entryId] = Object.keys(patch);
  if (
    !applyEntriesPatch(target.session, target.onyxKey, patch) ||
    addedTs === undefined
  ) {
    return undefined;
  }
  return {entryId, ts: addedTs};
}

/**
 * Change ONE named entry: the per-entry edit from the session timeline. Only
 * the fields named move, and an edit that changes nothing sends nothing.
 */
function editSessionEntry(
  sessionId: DrinkingSessionId | undefined,
  entryId: SessionEntryId,
  fields: AddEntryOverrides & {count?: number; drinkKey?: DrinkKey},
): void {
  const target = resolveEntryTarget(sessionId);
  if (!target) {
    return;
  }
  const patch = DSUtils.editSessionEntryById(
    target.session,
    entryId,
    {
      ts: fields.ts,
      volume_ml: fields.volume_ml,
      abv: fields.abv,
      count: fields.count,
      key: fields.drinkKey,
    },
    DateUtils.getServerTime(),
  );
  applyEntriesPatch(target.session, target.onyxKey, patch);
}

/**
 * Set a session's start and end time of day. Until now only whole-day shifts
 * were possible (`updateSessionDate`), which could move a session to another
 * date but never fix a start time that was half an hour out.
 *
 * Both times are absolute, so the write is replay-safe and the server owns the
 * `earliest_session_at` floor it may move.
 */
function setSessionTimes(
  sessionId: DrinkingSessionId | undefined,
  startTime: number,
  endTime: number,
): void {
  const session = DSUtils.getDrinkingSessionData(sessionId);
  const onyxKey = DSUtils.getDrinkingSessionOnyxKey(sessionId);
  if (!session || !onyxKey || !sessionId) {
    return;
  }
  if (session.start_time === startTime && session.end_time === endTime) {
    return;
  }
  const updated: DrinkingSession = {
    ...session,
    start_time: startTime,
    end_time: endTime,
  };
  DSUtils.setLocalSessionCache(onyxKey, updated);

  if (
    onyxKey === ONYXKEYS.ONGOING_SESSION_DATA &&
    sendLiveSessionDiff(session, updated, {
      shouldIncludeEntries: false,
      shouldIncludeEnd: false,
    })
  ) {
    return;
  }
  Onyx.merge(onyxKey, {start_time: startTime, end_time: endTime});
  if (onyxKey === ONYXKEYS.ONGOING_SESSION_DATA) {
    recordLiveSessionEdit(sessionId);
  }
}

/**
 * Delete ONE named entry: the precise delete, where the user pointed at a
 * drink in the session timeline rather than at a drink type.
 *
 * This is what entries buy over legacy buckets. A bucket holds a count and no
 * identity, so `removeDrinksFromList` can only guess which drink a removal
 * means (newest bucket first) and a rewrite of the bucket races every other
 * writer. Here the delete names the entry, the server tombstones exactly that
 * key, and a phone and a watch deleting different drinks at the same moment
 * cannot touch each other's.
 *
 * A no-op for a legacy session (no entry ids to name) and for an entry that
 * is already a tombstone, so a double tap on delete cannot fail.
 */
function removeSessionEntry(
  sessionId: DrinkingSessionId | undefined,
  entryId: SessionEntryId,
): void {
  const target = resolveEntryTarget(sessionId);
  if (!target) {
    return;
  }
  const patch = DSUtils.removeSessionEntryById(
    target.session,
    entryId,
    DateUtils.getServerTime(),
  );
  applyEntriesPatch(target.session, target.onyxKey, patch);
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
  if (!onyxKey) {
    return;
  }
  const current = DSUtils.getDrinkingSessionData(session?.id) ?? session;
  if (current) {
    DSUtils.setLocalSessionCache(onyxKey, {...current, note: newNote});
  }
  if (
    onyxKey === ONYXKEYS.ONGOING_SESSION_DATA &&
    sendLiveMetaOp(current, buildSetNoteOp(current?.note ?? '', newNote))
  ) {
    return;
  }
  Onyx.merge(onyxKey, {note: newNote});
  if (onyxKey === ONYXKEYS.ONGOING_SESSION_DATA) {
    recordLiveSessionEdit(current?.id ?? session?.id);
  }
}

/**
 * Rename a session (RFC §9).
 *
 * A session the user is currently in (live or being edited) lives in an Onyx
 * buffer, so the new name goes there and the session's own save persists it,
 * exactly like the note. A session that is already stored (renamed from its
 * summary, where there is no buffer) has nothing left to save it, so the new
 * name goes straight through the session update path.
 *
 * Renaming a legacy session writes `name` and nothing else: the session keeps
 * its schema, and only the backfill promotes it (RFC §11).
 */
function updateSessionName(
  sessionId: DrinkingSessionId | undefined,
  session: DrinkingSession | undefined,
  newName: string,
): void {
  if (!sessionId || !session) {
    Log.warn('updateSessionName: no session to rename');
    return;
  }
  const name = newName.trim();
  const onyxKey = DSUtils.getDrinkingSessionOnyxKey(sessionId);
  if (onyxKey) {
    const current = DSUtils.getDrinkingSessionData(sessionId) ?? session;
    Onyx.merge(onyxKey, {name});
    DSUtils.setLocalSessionCache(onyxKey, {...current, name});
    if (onyxKey === ONYXKEYS.ONGOING_SESSION_DATA) {
      recordLiveSessionEdit(sessionId);
    }
    return;
  }

  const userID = getFirebaseAuth().currentUser?.uid;
  if (!userID) {
    Log.warn('updateSessionName: no signed-in user to rename the session for');
    return;
  }
  const renamed: DrinkingSession = {...session, name};
  API.write(
    WRITE_COMMANDS.UPDATE_SESSION,
    {
      sessionId,
      session: renamed,
      sessionIsLive: false,
    },
    {optimisticData: sessionUpsertOptimisticData(userID, sessionId, renamed)},
  );
}

/**
 * Set a session's visibility (RFC §4.2). Same two cases as
 * {@link updateSessionName}: a session open in a buffer gets the value there
 * and its own save persists it, an already-stored session goes straight
 * through the session update path.
 *
 * A session with no `visibility` is `friends`, the RFC's default, and the
 * server reads it that way too, so setting it on a legacy session writes the
 * field without changing the session's schema.
 */
function updateSessionVisibility(
  sessionId: DrinkingSessionId | undefined,
  session: DrinkingSession | undefined,
  visibility: SessionVisibility,
): void {
  if (!sessionId || !session) {
    Log.warn('updateSessionVisibility: no session to update');
    return;
  }
  const onyxKey = DSUtils.getDrinkingSessionOnyxKey(sessionId);
  if (onyxKey) {
    const current = DSUtils.getDrinkingSessionData(sessionId) ?? session;
    Onyx.merge(onyxKey, {visibility});
    DSUtils.setLocalSessionCache(onyxKey, {...current, visibility});
    if (onyxKey === ONYXKEYS.ONGOING_SESSION_DATA) {
      recordLiveSessionEdit(sessionId);
    }
    return;
  }

  const userID = getFirebaseAuth().currentUser?.uid;
  if (!userID) {
    Log.warn('updateSessionVisibility: no signed-in user to update it for');
    return;
  }
  const updated: DrinkingSession = {...session, visibility};
  API.write(
    WRITE_COMMANDS.UPDATE_SESSION,
    {
      sessionId,
      session: updated,
      sessionIsLive: false,
    },
    {optimisticData: sessionUpsertOptimisticData(userID, sessionId, updated)},
  );
}

function updateBlackout(
  session: DrinkingSession | undefined,
  blackout: boolean,
): void {
  const onyxKey = DSUtils.getDrinkingSessionOnyxKey(session?.id);
  if (!onyxKey) {
    return;
  }
  const current = DSUtils.getDrinkingSessionData(session?.id) ?? session;
  if (current) {
    DSUtils.setLocalSessionCache(onyxKey, {...current, blackout});
  }
  if (
    onyxKey === ONYXKEYS.ONGOING_SESSION_DATA &&
    sendLiveMetaOp(current, buildSetBlackoutOp(!!current?.blackout, blackout))
  ) {
    return;
  }
  Onyx.merge(onyxKey, {blackout});
  if (onyxKey === ONYXKEYS.ONGOING_SESSION_DATA) {
    recordLiveSessionEdit(current?.id ?? session?.id);
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
  if (!onyxKey) {
    return;
  }
  const current = DSUtils.getDrinkingSessionData(session?.id) ?? session;
  if (current) {
    DSUtils.setLocalSessionCache(onyxKey, {...current, timezone: newTimezone});
  }
  // The timezone rides on `set_times`: it is the clock the session's start and
  // end read in, so it is the same question and needs no op of its own. The
  // times go out unchanged, which the server applies absolutely and which
  // leaves the earliest-session floor alone.
  if (
    current &&
    onyxKey === ONYXKEYS.ONGOING_SESSION_DATA &&
    sendLiveSessionDiff(
      current,
      {...current, timezone: newTimezone},
      {
        shouldIncludeEntries: false,
        shouldIncludeEnd: false,
      },
    )
  ) {
    return;
  }
  Onyx.merge(onyxKey, {timezone: newTimezone});
  if (onyxKey === ONYXKEYS.ONGOING_SESSION_DATA) {
    recordLiveSessionEdit(current?.id ?? session?.id);
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
  if (!shouldUpdateLiveSessionData) {
    // An edit session persists on save, which diffs it into ops then.
    return;
  }
  // A whole-day shift moves the session's times AND every drink in it, so on
  // the op path it is `set_times` plus one `edit_entry` per entry, each naming
  // the timestamp it must end up with. A single "shift by a day" op would be
  // shorter, but a shift is relative: a client that re-minted it after losing
  // the answer would shift the session twice.
  if (
    sendLiveSessionDiff(session, modifiedSession, {
      shouldIncludeEntries: true,
      shouldIncludeEnd: false,
    })
  ) {
    return;
  }
  recordLiveSessionEdit(sessionId);
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
  const newSession: DrinkingSession = withSchemaV2Meta(
    DSUtils.getEmptySession({
      id: newSessionId,
      start_time: timestamp,
      end_time: timestamp,
      type: CONST.SESSION.TYPES.EDIT,
      timezone,
    }),
  );

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
  addSessionEntry,
  editSessionEntry,
  generateDrinkingSessionId,
  removeSessionEntry,
  setSessionTimes,
  openFriendDrinkingSessions,
  navigateToEditSessionScreen,
  navigateToOngoingSessionScreen,
  removeDrinkingSessionData,
  resendUnsyncedSessionWrites,
  saveDrinkingSessionData,
  setIsCreatingNewSession,
  startLiveDrinkingSession,
  syncLocalLiveSessionData,
  updateBlackout,
  updateDrinks,
  updateNote,
  updateSessionName,
  updateSessionVisibility,
  updateLocalData,
  updateLocalSessionDataAndNavigate,
  updateSessionDate,
  updateTimezone,
  getNewSessionToEdit,
};
