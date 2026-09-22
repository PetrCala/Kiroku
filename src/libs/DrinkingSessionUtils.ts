import CONST from '@src/CONST';
import type {
  DrinkKey,
  DrinkingSession,
  DrinkingSessionArray,
  DrinkingSessionId,
  DrinkingSessionList,
  DrinkingSessionType,
  Drinks,
  DrinksList,
  DrinksToUnits,
  SessionEntries,
  SessionEntry,
  SessionEntryId,
  SessionEntrySource,
} from '@src/types/onyx';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type {SelectedTimezone, Timezone} from '@src/types/onyx/UserData';
import type {OnyxKey} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import {format, subMilliseconds} from 'date-fns';
import {formatInTimeZone} from 'date-fns-tz';
import type {
  AddDrinksOptions,
  RemoveDrinksOptions,
} from '@src/types/onyx/DrinkingSession';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import cloneDeep from 'lodash/cloneDeep';
// eslint-disable-next-line you-dont-need-lodash-underscore/includes
import includes from 'lodash/includes';
import min from 'lodash/min';
import type {ValueOf} from 'type-fest';
import type {ImageSourcePropType} from 'react-native';
import type {TranslationPaths} from '@src/languages/types';
import type IconAsset from '@src/types/utils/IconAsset';
import Log from './Log';
import DateUtils from './DateUtils';
import {
  getDrinkCount,
  getDrinkOverrides,
  makeDrinkEntry,
} from './DrinkEntryUtils';
import {
  getSessionEntries,
  getSessionEntriesOfType,
  legacyBucketsToEntries,
  sumEntryUnits,
} from './SessionEntries';
import {roundToTwoDecimalPlaces} from './NumberUtils';
import {getFirebaseAuth} from './Firebase/FirebaseApp';
import {numberToVerboseString} from './TimeUtils';

const PlaceholderDrinks: DrinksList = {[Date.now()]: {other: 0}};

let timezone: Required<Timezone> = CONST.DEFAULT_TIME_ZONE;
Onyx.connect({
  key: ONYXKEYS.USER_DATA_LIST,
  callback: value => {
    // Safe to call getFirebaseAuth() here - Onyx callbacks run after app initialization
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) {
      return;
    }
    const currentUserID = auth?.currentUser?.uid;
    const userDataTimezone = value?.[currentUserID]?.timezone;
    timezone = {
      selected: userDataTimezone?.selected ?? CONST.DEFAULT_TIME_ZONE.selected,
      automatic:
        userDataTimezone?.automatic ?? CONST.DEFAULT_TIME_ZONE.automatic,
    };
  },
});

let ongoingSessionData: DrinkingSession | undefined;
Onyx.connect({
  key: ONYXKEYS.ONGOING_SESSION_DATA,
  callback: value => {
    // For the session we already track, defer to the synchronous
    // `setLocalSessionCache`: every same-session write (taps, note/blackout/
    // timezone, cross-device adoption via `updateLocalData`) updates this cache
    // synchronously, so it is always at least as fresh as this Onyx notification.
    // The notification can be delayed while the JS thread is busy persisting, and
    // it may carry an OLDER snapshot of our own in-flight writes — adopting it
    // would regress the edit buffer mid-burst and drop/scramble taps. So only
    // react here to a brand-new session (start / cross-device first arrival / id
    // change) or a clear (finalize/discard).
    if (value && ongoingSessionData?.id === value.id) {
      return;
    }
    ongoingSessionData = value ?? undefined;
  },
});

let editSessionData: DrinkingSession | undefined;
Onyx.connect({
  key: ONYXKEYS.EDIT_SESSION_DATA,
  callback: value => {
    // See ONGOING_SESSION_DATA above: defer same-session updates to the
    // synchronous `setLocalSessionCache` so a delayed notification can't regress
    // an in-progress edit; only adopt a new session or a clear here.
    if (value && editSessionData?.id === value.id) {
      return;
    }
    editSessionData = value ?? undefined;
  },
});

/**
 * Synchronously drop the cached ongoing-session copy. Called from the finalize/
 * discard paths so a tap whose handler runs in the same tick as Save can't
 * re-route into `ONGOING_SESSION_DATA` before the async Onyx `set(null)`
 * notification lands. The `Onyx.connect` callback above clears it again when the
 * notification arrives; this just removes the race window.
 */
function clearOngoingSessionCache(): void {
  ongoingSessionData = undefined;
}

/**
 * Synchronously update the cached live/edit session. The `Onyx.connect` callbacks
 * above only refresh these caches after Onyx applies and notifies a write, which
 * lags a burst of rapid edits — and lags further while the JS thread is busy
 * persisting. Updating the cache here lets the next mutation compose on the
 * freshest value instead of a stale snapshot. Without it, a remove tapped right
 * after several adds reads an empty/older base and its `Onyx.set` wipes the
 * un-propagated adds (net-zero change).
 */
function setLocalSessionCache(
  onyxKey: OnyxKey,
  session: DrinkingSession | undefined,
): void {
  if (onyxKey === ONYXKEYS.ONGOING_SESSION_DATA) {
    ongoingSessionData = session;
  } else if (onyxKey === ONYXKEYS.EDIT_SESSION_DATA) {
    editSessionData = session;
  }
}

/**
 * @returns An empty drinking session object.
 */
function getEmptySession(session: Partial<DrinkingSession>): DrinkingSession {
  const emptySession: DrinkingSession = {
    id: session?.id,
    start_time: session?.start_time ?? Date.now(),
    end_time: session?.end_time ?? Date.now(),
    blackout: session?.blackout ?? false,
    note: session?.note ?? '',
    timezone: session?.timezone ?? CONST.DEFAULT_TIME_ZONE.selected,
    type: session?.type ?? CONST.SESSION.TYPES.EDIT,
    ongoing: session?.ongoing,
  };
  return emptySession;
}

/**
 * Check whether a drinking session is empty.
 */
function isEmptySession(session: DrinkingSession): boolean {
  return (
    session.start_time === 0 &&
    session.end_time === 0 &&
    isEmptyObject(session?.drinks) &&
    isEmptyObject(session?.entries) &&
    session.blackout === false &&
    session.note === ''
  );
}

/**
 * Based on the session ID, get the drinking session data.
 *
 * @param sessionId The ID of the session.
 * @returns The drinking session data.
 */
function getDrinkingSessionData(
  sessionId: DrinkingSessionId | undefined,
): DrinkingSession | undefined {
  if (ongoingSessionData && ongoingSessionData.id === sessionId) {
    return ongoingSessionData;
  }
  if (editSessionData && editSessionData.id === sessionId) {
    return editSessionData;
  }
  return undefined;
}

function getDrinkingSessionOnyxKey(
  sessionId: DrinkingSessionId | undefined,
): OnyxKey | null {
  if (!sessionId) {
    return null;
  }
  if (ongoingSessionData && ongoingSessionData.id === sessionId) {
    return ONYXKEYS.ONGOING_SESSION_DATA;
  }
  if (editSessionData && editSessionData.id === sessionId) {
    return ONYXKEYS.EDIT_SESSION_DATA;
  }
  return null;
}

/** Type guard to check if a given key is a valid DrinkType key */
function isDrinkTypeKey(key: string): key is keyof Drinks {
  return includes(Object.values(CONST.DRINKS.KEYS), key);
}

/**
 * From a list of drinking sessions, the id of the ongoing session, or null.
 *
 * Nothing stops the server from holding more than one session flagged
 * ongoing (a live session orphaned by a stale snapshot, a second one started
 * over it). `preferredId` wins when it is one of them, so a caller that
 * already holds a live session is never switched to another; otherwise the
 * newest by start time is the one the user most likely means, and not the
 * first key, which is the oldest.
 */
function getOngoingSessionId(
  drinkingSessions: DrinkingSessionList | null | undefined,
  preferredId?: DrinkingSessionId,
): DrinkingSessionId | null {
  if (isEmptyObject(drinkingSessions)) {
    return null;
  }
  if (preferredId && drinkingSessions[preferredId]?.ongoing === true) {
    return preferredId;
  }

  let newest: {id: DrinkingSessionId; startTime: number} | undefined;
  for (const [id, session] of Object.entries(drinkingSessions)) {
    if (session?.ongoing !== true) {
      continue;
    }
    const startTime = session.start_time ?? 0;
    if (!newest || startTime > newest.startTime) {
      newest = {id, startTime};
    }
  }
  return newest?.id ?? null;
}

/**
 * Returns the most recent COMPLETED session (latest `start_time`), excluding
 * any ongoing/in-progress session, together with its collection key
 * (`sessionId`). `undefined` when there are none.
 *
 * The key is returned explicitly because the session's own `id` field is only
 * populated locally and cannot be relied on — callers that need to navigate to
 * a specific session use this `sessionId`.
 */
function getLastSession(
  drinkingSessions: DrinkingSessionList | null | undefined,
): {sessionId: DrinkingSessionId; session: DrinkingSession} | undefined {
  if (isEmptyObject(drinkingSessions)) {
    return undefined;
  }

  let latest:
    | {sessionId: DrinkingSessionId; session: DrinkingSession}
    | undefined;
  Object.entries(drinkingSessions).forEach(([sessionId, session]) => {
    if (!session || session.ongoing) {
      return;
    }
    if (!latest || session.start_time > latest.session.start_time) {
      latest = {sessionId, session};
    }
  });

  return latest;
}

/** How many of the user's sessions are finished (not ongoing). */
function countCompletedSessions(
  drinkingSessions: DrinkingSessionList | null | undefined,
): number {
  if (isEmptyObject(drinkingSessions)) {
    return 0;
  }
  return Object.values(drinkingSessions).filter(
    session => !!session && !session.ongoing,
  ).length;
}

/**
 * The total units of a session: every entry's `count` times the user's
 * per-type factor, read through the entries adapter so a legacy session and
 * a v2 session with the same drinks give the same number.
 *
 * @param session - The session (legacy buckets or v2 entries).
 * @param drinksToUnits - A mapping from DrinkKey to unit conversion factors.
 * @param roundUp - Round the result to two decimal places.
 * @returns The total units calculated.
 */
function calculateTotalUnits(
  session: DrinkingSession | null | undefined,
  drinksToUnits: DrinksToUnits | undefined,
  roundUp?: boolean,
): number {
  const totalUnits = sumEntryUnits(getSessionEntries(session), drinksToUnits);
  if (roundUp) {
    return roundToTwoDecimalPlaces(totalUnits);
  }
  return totalUnits;
}

/**
 * The total units of a legacy `DrinksList` on its own, for the bucket write
 * path (`addDrinksToList`) that composes a new list before it lands on a
 * session. Same unit function as `calculateTotalUnits`.
 */
function calculateDrinksListUnits(
  drinks: DrinksList | undefined,
  drinksToUnits: DrinksToUnits | undefined,
): number {
  return sumEntryUnits(
    Object.values(legacyBucketsToEntries(drinks, '')),
    drinksToUnits,
  );
}

/**
 * Calculate how many units are available to add based on the session's
 * current drinks and the drinksToUnits mapping.
 *
 * @param session The session
 * @param drinksToUnits The mapping from DrinkKey to unit conversion factors.
 * @returns The number of units available to add
 */
function calculateAvailableUnits(
  session: DrinkingSession | null | undefined,
  drinksToUnits: DrinksToUnits,
): number {
  const currentUnits = calculateTotalUnits(session, drinksToUnits);
  return CONST.MAX_ALLOWED_UNITS - currentUnits;
}

/** The drink time an add lands on, per the session's add options. */
function resolveAddTimestamp(options: AddDrinksOptions, now: number): number {
  if (options.timestampOption === 'now') {
    return now;
  }
  if (options.timestampOption === 'sessionEndTime') {
    return options.end_time;
  }
  if (options.timestampOption === 'sessionStartTime') {
    return options.start_time;
  }
  throw new Error('Invalid timestampOption');
}

/**
 * Adds a Drinks object to an existing DrinksList object with a specified timestamp behavior.
 * It checks if the total units exceed the maximum allowed units before adding.
 *
 * @param drinkType - The type of drink to add.
 * @param amount - The amount of the drink to add.
 * @param drinksList - The existing DrinksList object.
 * @param drinksToUnits - A mapping from DrinkKey to unit conversion factors.
 * @param options - Options to specify the timestamp behavior.
 * @param maxUnits - The maximum allowed units. Defaults to CONST.MAX_ALLOWED_UNITS.
 * @returns The updated DrinksList object.
 */
function addDrinksToList(
  drinkKey: DrinkKey,
  amount: number,
  drinksList: DrinksList | undefined,
  drinksToUnits: DrinksToUnits,
  options: AddDrinksOptions,
): DrinksList {
  // Create a shallow copy of drinksList to avoid mutating the original
  const updatedDrinksList = drinksList ? {...drinksList} : {};

  if (amount <= 0) {
    Log.warn(`Invalid amount: ${amount}`);
    return updatedDrinksList;
  }

  if (!drinksToUnits[drinkKey]) {
    Log.warn(`Invalid drink key: ${drinkKey}`);
    return updatedDrinksList;
  }

  const availableUnits =
    CONST.MAX_ALLOWED_UNITS -
    calculateDrinksListUnits(drinksList, drinksToUnits);
  const newUnits = amount * (drinksToUnits[drinkKey] || 0);
  if (newUnits > availableUnits) {
    // TODO potentially show a warning message to the user
    Log.warn('Total units exceed the maximum allowed units. Drinks not added.');
    return updatedDrinksList;
  }

  const timestamp = resolveAddTimestamp(options, Date.now());

  if (updatedDrinksList[timestamp]) {
    // Timestamp already exists, merge the drinks
    const existingDrinks = updatedDrinksList[timestamp];
    const mergedDrinks: Drinks = {...existingDrinks};

    const existingEntry = mergedDrinks[drinkKey];
    const newCount = getDrinkCount(existingEntry) + (amount ?? 0);
    // Preserve any existing volume_ml / abv overrides on this slot when only
    // the count changes; the v2-B UI is the only producer of overrides.
    mergedDrinks[drinkKey] = makeDrinkEntry(
      newCount,
      getDrinkOverrides(existingEntry),
    );

    updatedDrinksList[timestamp] = mergedDrinks;
  } else {
    // Timestamp does not exist, add the drinks
    updatedDrinksList[timestamp] = {[drinkKey]: makeDrinkEntry(amount)};
  }

  return updatedDrinksList;
}

/**
 * LEGACY ONLY. Removes drinks from a `drinks[timestamp][drinkKey]` bucket map.
 *
 * A bucket holds a COUNT and nothing else, so there is no way to say WHICH
 * drink is being removed: this picks victims newest-bucket-first and hopes.
 * It is also why two writers (the phone and the watch) could clobber each
 * other on the old write path. A `schema_version: 2` session has neither
 * problem: every drink is an entry with an id, and a removal names the ids it
 * takes (`selectEntriesForRemoval`) or one id outright
 * (`removeSessionEntryById`). Kept only for sessions the §11 backfill has not
 * converted yet.
 *
 * @param drinkKey - The drink key to remove.
 * @param amount - The number of drinks to remove.
 * @param drinksList - The existing DrinksList from which to remove drinks.
 * @param options - The behavior for removal ('removeFromLatest' or 'removeFromEarliest').
 * @returns The updated DrinksList after removal.
 */
function removeDrinksFromList(
  drinkKey: DrinkKey,
  amount: number,
  drinksList: DrinksList | undefined,
  options: RemoveDrinksOptions,
): DrinksList {
  if (!drinksList) {
    return {};
  }

  if (amount <= 0) {
    Log.warn(`Invalid amount: ${amount}`);
    return drinksList;
  }

  const updatedDrinksList: DrinksList = cloneDeep(drinksList);

  let remainingAmountToRemove = amount ?? 0;

  for (const timestamp of Object.keys(updatedDrinksList).sort((a, b) =>
    options === 'removeFromLatest' ? +b - +a : +a - +b,
  )) {
    const drinksAtTimestamp = updatedDrinksList[+timestamp];
    const existingEntry = drinksAtTimestamp[drinkKey];
    const avaiableAmount = getDrinkCount(existingEntry);

    if (avaiableAmount > 0) {
      const amountRemoved = Math.min(remainingAmountToRemove, avaiableAmount);
      const newCount = avaiableAmount - amountRemoved;

      remainingAmountToRemove -= amountRemoved;

      // Clean up if there are zero drinks left for this type at this timestamp
      if (newCount === 0) {
        delete drinksAtTimestamp[drinkKey];
      } else {
        // Preserve any existing volume_ml / abv overrides on the slot.
        drinksAtTimestamp[drinkKey] = makeDrinkEntry(
          newCount,
          getDrinkOverrides(existingEntry),
        );
      }

      // Clean up if there are zero drinks left at this timestamp
      if (Object.keys(drinksAtTimestamp).length === 0) {
        delete updatedDrinksList[+timestamp];
      }
    }

    if (remainingAmountToRemove <= 0) {
      break;
    }
  }
  return updatedDrinksList;
}

/**
 * Get the options for adding drinks to a session based on the session state.
 *
 * @param session The session to add drinks to
 * @returns The options for adding drinks
 */
function getSessionAddDrinksOptions(
  session: DrinkingSession,
): AddDrinksOptions {
  if (session?.ongoing) {
    return {
      timestampOption: 'now',
    };
  }

  if (session?.type === CONST.SESSION.TYPES.LIVE && session?.end_time) {
    return {
      timestampOption: 'sessionEndTime',
      end_time: session.end_time,
    };
  }

  return {
    timestampOption: 'sessionStartTime',
    start_time: session.start_time,
  };
}

/**
 * Modify the drinks in a session based on the action.
 *
 * @param session The session to modify
 * @param drinkKey The key of the drink to modify
 * @param amount The amount of the drink to modify
 * @param drinksToUnits The mapping from drink keys to units
 * @param action The action to perform
 * @returns The updated drinks list
 */
function modifySessionDrinks(
  session: DrinkingSession,
  drinkKey: DrinkKey,
  amount: number,
  action: ValueOf<typeof CONST.DRINKS.ACTIONS>,
  drinksToUnits: DrinksToUnits,
): DrinksList | undefined {
  let drinksList = cloneDeep(session?.drinks);
  if (action === 'add') {
    const options: AddDrinksOptions = getSessionAddDrinksOptions(session);
    drinksList = addDrinksToList(
      drinkKey,
      amount,
      drinksList,
      drinksToUnits,
      options,
    );
  } else if (action === 'remove') {
    // Newest bucket first: the only order a bucket map allows (see
    // `removeDrinksFromList`). A v2 session removes by entry id instead.
    drinksList = removeDrinksFromList(
      drinkKey,
      amount,
      drinksList,
      'removeFromLatest',
    );
  }

  return drinksList;
}

/**
 * What an ADD may name for itself, beyond the drink type and the amount: the
 * time it happened (a retro-add) and the serving it was (a preset, or a value
 * typed into the per-entry edit). Anything omitted falls back to the session's
 * add time and to `CONST.DRINK_DEFAULTS`.
 */
type AddEntryOverrides = {
  ts?: number;
  volume_ml?: number;
  abv?: number;
};

/** What `modifySessionEntries` changed: the whole map and the changed entries. */
type SessionEntriesChange = {
  /** The session's entries after the change */
  entries: SessionEntries;

  /** Only the entries that were added or edited, for an Onyx merge */
  patch: SessionEntries;

  /** The drink time of the entry an ADD created; undefined otherwise */
  addedTs?: number;
};

/**
 * The Sessions v2 counterpart of `modifySessionDrinks`: change a v2 session's
 * entries for an add or a remove and report exactly what changed.
 *
 * - ADD appends one entry for `amount` drinks of `drinkKey` at the session's
 *   add time (now for a live session, the start or end otherwise), authored
 *   by and targeting `authorUid`, under the id `mintEntryId` returns (a push
 *   id from the action layer). The max-units guard applies as for legacy
 *   sessions.
 * - REMOVE takes `amount` drinks off the latest entries of `drinkKey` first:
 *   an entry the removal empties becomes a tombstone (`deleted: true`), one
 *   it only reduces keeps its id with a smaller `count`. Keys are never
 *   removed from the map (RFC §4.3).
 *
 * Times are in server-corrected time (`DateUtils.getServerTime`).
 */
function modifySessionEntries(
  session: DrinkingSession,
  drinkKey: DrinkKey,
  amount: number,
  action: ValueOf<typeof CONST.DRINKS.ACTIONS>,
  drinksToUnits: DrinksToUnits,
  authorUid: UserID,
  source: SessionEntrySource,
  mintEntryId: () => SessionEntryId,
  overrides: AddEntryOverrides = {},
): SessionEntriesChange {
  const entries: SessionEntries = {...(session.entries ?? {})};
  const unchanged: SessionEntriesChange = {entries, patch: {}};
  if (amount <= 0) {
    Log.warn(`Invalid amount: ${amount}`);
    return unchanged;
  }
  const now = DateUtils.getServerTime();

  if (action === CONST.DRINKS.ACTIONS.ADD) {
    if (!drinksToUnits[drinkKey]) {
      Log.warn(`Invalid drink key: ${drinkKey}`);
      return unchanged;
    }
    const newUnits = amount * (drinksToUnits[drinkKey] || 0);
    if (newUnits > calculateAvailableUnits(session, drinksToUnits)) {
      Log.warn(
        'Total units exceed the maximum allowed units. Drinks not added.',
      );
      return unchanged;
    }
    // A retro-add names its own time ("this beer was 20 minutes ago");
    // otherwise the session decides (now while live, its start or end when
    // editing a past session).
    const ts =
      overrides.ts ??
      resolveAddTimestamp(getSessionAddDrinksOptions(session), now);
    const entry: SessionEntry = {
      ts,
      key: drinkKey,
      count: amount,
      source,
      author_uid: authorUid,
      target_uid: authorUid,
      created_at: now,
    };
    // Only a serving the user actually chose is stamped. An entry without
    // them falls back to `CONST.DRINK_DEFAULTS` at read time (RFC §4.3), so
    // storing the defaults would add bytes and say nothing.
    if (overrides.volume_ml !== undefined) {
      entry.volume_ml = overrides.volume_ml;
    }
    if (overrides.abv !== undefined) {
      entry.abv = overrides.abv;
    }
    const id = mintEntryId();
    entries[id] = entry;
    return {entries, patch: {[id]: entry}, addedTs: ts};
  }

  const patch = selectEntriesForRemoval(session, drinkKey, amount, now);
  return {entries: {...entries, ...patch}, patch};
}

/**
 * Which entries a "remove N drinks of this type" action takes, and what each
 * of them becomes. Newest first, by the adapter's `(ts, id)` order.
 *
 * This is the precise counterpart of `removeDrinksFromList`. The ORDER is the
 * same (the newest drink of that type is the one the user means to take back),
 * but the RESULT is not a guess: every entry it touches is named by its id, so
 * the write is `delete_entry { entryId }` or `edit_entry { entryId, count }`
 * rather than a rewrite of a shared bucket. An entry the removal empties
 * becomes a tombstone and KEEPS its key (RFC §4.3); one it only partly eats
 * keeps its id with a smaller `count`.
 *
 * Returns the changed entries only, keyed by id: an empty map when there is
 * nothing of that type left to remove.
 */
function selectEntriesForRemoval(
  session: DrinkingSession,
  drinkKey: DrinkKey,
  amount: number,
  now: number,
): SessionEntries {
  const patch: SessionEntries = {};
  if (amount <= 0) {
    return patch;
  }
  const latestFirst = [...getSessionEntriesOfType(session, drinkKey)].reverse();
  let remaining = amount;
  for (const {id, ...entry} of latestFirst) {
    if (remaining <= 0) {
      break;
    }
    patch[id] =
      entry.count <= remaining
        ? {...entry, deleted: true, edited_at: now}
        : {...entry, count: entry.count - remaining, edited_at: now};
    remaining -= entry.count;
  }
  return patch;
}

/**
 * Tombstone ONE named entry: the precise delete the session timeline and undo
 * use, where the user pointed at a drink rather than at a drink type.
 *
 * Returns the changed entry keyed by its id, or an empty map when the session
 * has no such live entry (already a tombstone, or never there), so a repeated
 * delete is a no-op rather than an error. A legacy session has no entry ids at
 * all and always yields an empty map; the caller keeps
 * `modifySessionDrinks` for those.
 */
/**
 * Change the fields of ONE named entry: the per-entry edit from the session
 * timeline. Only the fields the caller names move; `edited_at` is stamped so
 * a reader can tell an edited entry from an untouched one.
 *
 * Returns the changed entry keyed by its id, or an empty map when the session
 * has no such live entry or the edit would change nothing, so a no-op edit
 * sends no op.
 */
function editSessionEntryById(
  session: DrinkingSession,
  entryId: SessionEntryId,
  fields: AddEntryOverrides & {count?: number; key?: DrinkKey},
  now: number,
): SessionEntries {
  const entry = session.entries?.[entryId];
  if (!entry || entry.deleted === true) {
    return {};
  }
  const updated: SessionEntry = {...entry};
  let hasChanged = false;
  for (const field of ['ts', 'key', 'count', 'volume_ml', 'abv'] as const) {
    const value = fields[field];
    if (value !== undefined && value !== entry[field]) {
      // The union of the five field types is wider than any one of them, so
      // the assignment needs the cast; the loop's key/value pairing is what
      // keeps it sound.
      (updated as Record<string, unknown>)[field] = value;
      hasChanged = true;
    }
  }
  if (!hasChanged) {
    return {};
  }
  updated.edited_at = now;
  return {[entryId]: updated};
}

function removeSessionEntryById(
  session: DrinkingSession,
  entryId: SessionEntryId,
  now: number,
): SessionEntries {
  const entry = session.entries?.[entryId];
  if (!entry || entry.deleted === true) {
    return {};
  }
  return {[entryId]: {...entry, deleted: true, edited_at: now}};
}

function sessionIsExpired(session: DrinkingSession | undefined): boolean {
  if (!session) {
    return false;
  }
  const expirationBoundary = Date.now() - CONST.SESSION_EXPIRY;
  return session.start_time < expirationBoundary;
}

/** Calculate a length of a sesison either as a number, or as a string */
function calculateSessionLength(
  session: DrinkingSession | undefined,
  returnString?: boolean,
): number | string {
  if (!session) {
    return returnString ? '0s' : 0;
  }
  const length = session?.end_time ? session.end_time - session.start_time : 0;
  if (returnString) {
    return numberToVerboseString(length, false);
  }
  return length;
}

/**
 * From a list of drinking sessions, extract a single session object.
 * If the list does not contain the session, return an empty session.
 */
function extractSessionOrEmpty(
  sessionId: DrinkingSessionId,
  drinkingSessionData: DrinkingSessionList | undefined,
): DrinkingSession {
  if (isEmptyObject(drinkingSessionData)) {
    return getEmptySession({});
  }
  if (
    drinkingSessionData &&
    Object.keys(drinkingSessionData).includes(sessionId)
  ) {
    return drinkingSessionData[sessionId];
  }
  return getEmptySession({});
}

/** Given a DrinkingSession object, determine its type (i.e.,
 *  the most number of units the user has in this session).
 *
 * If there are no drinks in the session, return null.
 * */
function determineSessionMostCommonDrink(
  session: DrinkingSession | undefined | null,
): DrinkKey | undefined | null {
  if (!session) {
    return null;
  }
  const entries = getSessionEntries(session);
  if (entries.length === 0) {
    return null;
  }
  const drinkCounts: Partial<Record<DrinkKey, number>> = {};
  entries.forEach(entry => {
    drinkCounts[entry.key] = (drinkCounts[entry.key] ?? 0) + entry.count;
  });

  // Find the drink with the highest count
  let mostCommonDrink: DrinkKey | null = null;
  let highestCount = 0;
  let isTie = false;
  Object.entries(drinkCounts).forEach(([drinkKey, count]) => {
    if (!count) {
      return;
    }
    if (count > highestCount) {
      highestCount = count;
      mostCommonDrink = drinkKey as DrinkKey;
      isTie = false; // Reset the tie flag as we have a new leader
    } else if (count === highestCount) {
      isTie = true; // A tie has occurred
    }
  });

  // In case of no single winner, return 'other'
  if (isTie && highestCount > 0) {
    return CONST.DRINKS.KEYS.OTHER;
  }

  return mostCommonDrink;
}

/** Subset an array of drinking sessions to a single day.
 *
 * @param dateObject Date type object for whose day to subset the sessions to
 * @param sessions An array of sessions to subset
 * @param returnArray If true, return an array of sessions without IDs. If false,
 *  simply subset the drinking session list to the relevant sessions.
 * @returns The subsetted array of sessions
 */
function getSingleDayDrinkingSessions(
  date: Date,
  sessions: DrinkingSessionList | undefined,
  returnArray = true,
): DrinkingSessionArray | DrinkingSessionList {
  if (!sessions) {
    return returnArray ? [] : {};
  }

  const baseTimezone = timezone.selected;
  const timezoneCache: Record<
    string,
    {startOfDayUTC: number; endOfDayUTC: number}
  > = {};

  const sessionBelongsToDate = (session: DrinkingSession) => {
    const tz = session.timezone ?? baseTimezone;

    // Cache the start and end of day UTC timestamps per timezone
    if (!timezoneCache[tz]) {
      timezoneCache[tz] = DateUtils.getDayStartAndEndUTC(date, tz);
    }

    const {startOfDayUTC, endOfDayUTC} = timezoneCache[tz];
    const sessionStartTime = session.start_time; // UTC timestamp in milliseconds

    // Directly compare UTC timestamps
    return sessionStartTime >= startOfDayUTC && sessionStartTime <= endOfDayUTC;
  };

  const filteredSessions = returnArray
    ? Object.values(sessions).filter(sessionBelongsToDate)
    : Object.fromEntries(
        Object.entries(sessions).filter(([, session]) =>
          sessionBelongsToDate(session),
        ),
      );

  return filteredSessions;
}

/** Subset an array of drinking sessions to the current month only.
 *
 * @param date Date type object for whose month to subset the sessions to
 * @param sessions An array of sessions to subset
 * @param untilToday If true, include no sessions that occured after today
 * @returns The subsetted array of sessions
 */
function getSingleMonthDrinkingSessions(
  date: Date,
  sessions: DrinkingSessionArray,
  untilToday = false,
): DrinkingSessionArray {
  const baseTimezone = timezone.selected;
  const timezoneCache: Record<
    string,
    {startOfMonthUTC: number; endOfMonthUTC: number}
  > = {};

  const sessionBelongsToMonth = (session: DrinkingSession) => {
    const tz = session.timezone ?? baseTimezone;

    // Cache the start and end of month UTC timestamps per timezone
    if (!timezoneCache[tz]) {
      timezoneCache[tz] = DateUtils.getMonthStartAndEndUTC(
        date,
        tz,
        untilToday,
      );
    }

    const {startOfMonthUTC, endOfMonthUTC} = timezoneCache[tz];
    const sessionStartTime = session.start_time; // Assuming it's a UTC timestamp in milliseconds

    // Directly compare UTC timestamps
    return (
      sessionStartTime >= startOfMonthUTC && sessionStartTime <= endOfMonthUTC
    );
  };

  const filteredSessions = sessions.filter(sessionBelongsToMonth);
  return filteredSessions;
}
/**
 * Get the displayName for a single session participant.
 */
function getDisplayNameForParticipant(
  userID?: UserID,
  // shouldUseShortForm = false,
  // shouldFallbackToHidden = true,
  // shouldAddCurrentUserPostfix = false,
): string {
  if (!userID) {
    return '';
  }
  return 'not-yet-implemented'; // TODO implement this

  // const personalDetails = getUserDataForUserID(userID);
  // // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  // const formattedLogin = LocalePhoneNumber.formatPhoneNumber(
  //   personalDetails.login || '',
  // );
  // // This is to check if account is an invite/optimistically created one
  // // and prevent from falling back to 'Hidden', so a correct value is shown
  // // when searching for a new user
  // if (personalDetails.isOptimisticPersonalDetail === true) {
  //   return formattedLogin;
  // }

  // // For selfDM, we display the user's displayName followed by '(you)' as a postfix
  // const shouldAddPostfix =
  //   shouldAddCurrentUserPostfix && userID === currentUserID;

  // const longName = UserDataUtils.getDisplayNameOrDefault(
  //   personalDetails,
  //   formattedLogin,
  //   shouldFallbackToHidden,
  //   shouldAddPostfix,
  // );

  // // If the user's personal details (first name) should be hidden, make sure we return "hidden" instead of the short name
  // if (
  //   shouldFallbackToHidden &&
  //   longName === Localize.translateLocal('common.hidden')
  // ) {
  //   return longName;
  // }

  // const shortName = personalDetails.firstName
  //   ? personalDetails.firstName
  //   : longName;
  // return shouldUseShortForm ? shortName : longName;
}

/**
 * Returns the the display names of the given user accountIDs
 */
function getUserDetailTooltipText(
  accountID: UserID,
  fallbackUserDisplayName = '',
): string {
  const displayNameForParticipant = getDisplayNameForParticipant(accountID);
  return displayNameForParticipant || fallbackUserDisplayName;
}

/**
 * Determine whether the given session is on a different day when converted to the given timezone.
 *
 * @param session The session to check
 * @param timezone The timezone to convert the session to
 * @returns Whether the session is on a different day
 */
function isDifferentDay(
  session: DrinkingSession,
  tz: SelectedTimezone,
): boolean {
  const stringFormat = 'yyyy-MM-dd';
  const start_time = session.start_time;
  let currentDay: string;
  if (session.timezone) {
    currentDay = formatInTimeZone(start_time, session.timezone, stringFormat);
  } else {
    currentDay = format(start_time, stringFormat);
  }
  const newDay = formatInTimeZone(session.start_time, tz, stringFormat);
  return currentDay !== newDay;
}

/**
 * Earliest `start_time` across a session collection, or undefined if empty.
 */
function getEarliestSessionStartTime(
  data:
    | DrinkingSessionList
    | Record<string, DrinkingSession>
    | undefined
    | null,
): number | undefined {
  if (isEmptyObject(data)) {
    return undefined;
  }
  return min(Object.values(data).map(session => session.start_time));
}

/**
 * Get the date on which a user started tracking their alcohol consumption / drinking sessions
 *
 * @param drinkingSessionsData The user's drinking session data
 * @returns [Date | null]
 */
function getUserTrackingStartDate(
  data: DrinkingSessionList | undefined | null,
): Date | null {
  const earliestTimestamp = getEarliestSessionStartTime(data);
  if (!earliestTimestamp) {
    return null;
  }
  return new Date(earliestTimestamp);
}

/**
 * Modify all timestamps of a drinking session and return the updated session
 *
 * @param session The session to update
 * @param millisecondsToSub How many milliseconds to subtract the timestamps by
 */
function shiftSessionTimestamps(
  session: DrinkingSession,
  millisecondsToSub: number,
): DrinkingSession {
  if (millisecondsToSub === 0) {
    return session;
  }
  const convertedSession = {...session};
  convertedSession.start_time = subMilliseconds(
    session.start_time,
    millisecondsToSub,
  ).getTime();
  if (session.end_time) {
    convertedSession.end_time = subMilliseconds(
      session.end_time,
      millisecondsToSub,
    ).getTime();
  }

  const convertedDrinks: DrinksList = {};
  const existingTimestamps = new Set<number>();

  if (!isEmptyObject(session.drinks)) {
    Object.entries(session.drinks).forEach(([timestamp, drinksAtTimestamp]) => {
      let newTimestamp = subMilliseconds(
        Number(timestamp),
        millisecondsToSub,
      ).getTime();

      // Ensure the new timestamp is unique by checking for collisions
      while (existingTimestamps.has(newTimestamp)) {
        newTimestamp += 1; // Increment timestamp slightly to avoid collision
      }

      existingTimestamps.add(newTimestamp);
      convertedDrinks[newTimestamp] = drinksAtTimestamp;
    });

    convertedSession.drinks = convertedDrinks;
  }

  // v2 entries keep their ids; only the drink time moves.
  if (!isEmptyObject(session.entries)) {
    const convertedEntries: NonNullable<DrinkingSession['entries']> = {};
    Object.entries(session.entries).forEach(([entryId, entry]) => {
      convertedEntries[entryId] = {
        ...entry,
        ts: subMilliseconds(entry.ts, millisecondsToSub).getTime(),
      };
    });
    convertedSession.entries = convertedEntries;
  }

  return convertedSession;
}

/** Based on a session type, return the icon that should be associated with this session */
function getIconForSession(
  sessionType: DrinkingSessionType | undefined,
): IconAsset | ImageSourcePropType {
  switch (sessionType) {
    case CONST.SESSION.TYPES.LIVE:
      return KirokuIcons.Stopwatch;
    case CONST.SESSION.TYPES.EDIT:
      return KirokuIcons.Edit;
    default:
      return KirokuIcons.AlcoholAssortment;
  }
}

function isRealtimeSession(type: DrinkingSessionType): boolean {
  return type in CONST.SESSION.REALTIME;
}

function getSessionTypeTitle(
  sessionType: DrinkingSessionType,
): TranslationPaths {
  switch (sessionType) {
    case CONST.SESSION.TYPES.LIVE:
      return 'drinkingSession.live.title';
    case CONST.SESSION.TYPES.EDIT:
      return 'drinkingSession.edit.title';
    default:
      return 'common.unknown';
  }
}

/** Return a description for a session type */
function getSessionTypeDescription(
  sessionType: DrinkingSessionType,
): TranslationPaths {
  switch (sessionType) {
    case CONST.SESSION.TYPES.LIVE:
      return 'drinkingSession.live.description';
    case CONST.SESSION.TYPES.EDIT:
      return 'drinkingSession.edit.description';
    default:
      return 'common.unknown';
  }
}

export type {AddEntryOverrides, SessionEntriesChange};
export {
  PlaceholderDrinks,
  addDrinksToList,
  calculateAvailableUnits,
  calculateSessionLength,
  calculateTotalUnits,
  clearOngoingSessionCache,
  countCompletedSessions,
  determineSessionMostCommonDrink,
  extractSessionOrEmpty,
  getDisplayNameForParticipant,
  getDrinkingSessionData,
  getDrinkingSessionOnyxKey,
  getEarliestSessionStartTime,
  getEmptySession,
  getIconForSession,
  getLastSession,
  getOngoingSessionId,
  getSessionAddDrinksOptions,
  getSessionTypeDescription,
  getSessionTypeTitle,
  getSingleDayDrinkingSessions,
  getSingleMonthDrinkingSessions,
  getUserDetailTooltipText,
  getUserTrackingStartDate,
  isDifferentDay,
  isDrinkTypeKey,
  isEmptySession,
  isRealtimeSession,
  modifySessionDrinks,
  modifySessionEntries,
  removeDrinksFromList,
  editSessionEntryById,
  removeSessionEntryById,
  selectEntriesForRemoval,
  sessionIsExpired,
  setLocalSessionCache,
  shiftSessionTimestamps,
};
