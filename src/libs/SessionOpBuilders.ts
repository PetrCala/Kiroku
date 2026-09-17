import type {TupleToUnion} from 'type-fest';
import CONST from '@src/CONST';
import type {DrinkingSession} from '@src/types/onyx';
import type {
  SessionEntry,
  SessionEntryId,
} from '@src/types/onyx/SessionEntries';
import type SessionEntries from '@src/types/onyx/SessionEntries';
import type {SessionOpPayload, SessionOpType} from './API/parameters';

/**
 * Turning a change to a session into the ops that express it (Sessions v2
 * RFC §5.1). Pure: no Onyx, no network, no clock. The action layer
 * (`actions/DrinkingSession.ts`) sends what these return.
 *
 * Two rules shape everything here:
 *
 * 1. **Every op is absolute.** An op names the value a field must end up
 *    with, never a delta to apply to it. That is what makes an op safe to
 *    replay, to coalesce with a later op for the same entry, and to apply out
 *    of order with respect to a write the client never saw land (RFC §5.1,
 *    §5.3). A "shift every timestamp by a day" op would be shorter than the
 *    `edit_entry` per entry this builds, but a replay would shift twice.
 * 2. **Every op carries its own undo.** `patch` is what the op does to the
 *    local copy of the session (the op's optimistic data) and `undo` is what
 *    puts it back (its failure data), so one rejected op rolls back exactly
 *    its own change and leaves the rest of a save standing.
 */

const {START, END, SET_TIMES, ADD_ENTRY, EDIT_ENTRY, DELETE_ENTRY} =
  CONST.SESSION_OP.TYPE;
const {SET_NOTE, SET_BLACKOUT, SET_VISIBILITY, RENAME} = CONST.SESSION_OP.TYPE;

/** A patch merged into a session's local copy. Nested `null` deletes a key. */
type SessionPatch = Record<string, unknown>;

/** One op to send, with the local change it stands for and its undo. */
type PendingSessionOp = {
  /** The op type, as `CONST.SESSION_OP.TYPE` names it. */
  type: SessionOpType;

  /** The op's per-type fields. */
  payload: SessionOpPayload;

  /** What the op does to the session locally (its optimistic data). */
  patch: SessionPatch;

  /** What undoes `patch` (its failure data). */
  undo: SessionPatch;
};

/** What a session diff should cover beyond its meta. */
type SessionDiffOptions = {
  /**
   * Also diff the `entries` map. False for a live session's save: every entry
   * change was already sent as its own op while the session ran, so diffing
   * them again against a cached snapshot that may lag the queue would only
   * resend ops that already landed.
   */
  shouldIncludeEntries?: boolean;

  /**
   * Emit `end` when the edited session is closed and the stored one was not.
   * False for an edit that is not a save (a date change, a timezone change).
   */
  shouldIncludeEnd?: boolean;
};

/** The entry fields a client may set; the server owns the rest (RFC §4.3). */
const CLIENT_ENTRY_FIELDS = ['ts', 'key', 'count', 'volume_ml', 'abv'] as const;

type ClientEntryField = TupleToUnion<typeof CLIENT_ENTRY_FIELDS>;

function entryFieldsPayload(entry: SessionEntry): SessionOpPayload {
  const payload: SessionOpPayload = {};
  for (const field of CLIENT_ENTRY_FIELDS) {
    const value = entry[field];
    if (value !== undefined) {
      payload[field] = value;
    }
  }
  return payload;
}

/** Whether any client-settable field of `entry` differs from `previous`. */
function entryFieldsChanged(
  previous: SessionEntry,
  entry: SessionEntry,
): boolean {
  return CLIENT_ENTRY_FIELDS.some(
    (field: ClientEntryField) => previous[field] !== entry[field],
  );
}

/**
 * `add_entry` for a new drink. `source` is required by the server, so an entry
 * built without one cannot be sent; callers stamp it (`getEntrySource`).
 */
function addEntryOp(
  entryId: SessionEntryId,
  entry: SessionEntry,
): PendingSessionOp {
  return {
    type: ADD_ENTRY,
    payload: {entryId, source: entry.source, ...entryFieldsPayload(entry)},
    patch: {entries: {[entryId]: entry}},
    // Onyx merge-deletes on a nested `null`, so this drops the entry the add
    // put there rather than leaving a hollow one behind.
    undo: {entries: {[entryId]: null}},
  };
}

/**
 * `edit_entry` naming every client-settable field, not only the changed ones:
 * an absolute op stays correct when the queue coalesces it with an earlier op
 * for the same entry, or when it is applied after a write this client never
 * saw.
 *
 * A field the entry does not carry is left out, and the server treats an
 * absent field as "leave it alone". So an override (`volume_ml`, `abv`) cannot
 * be CLEARED through this op, only overwritten. Nothing clears one today; the
 * capture UI sets an explicit value instead.
 */
function editEntryOp(
  entryId: SessionEntryId,
  previous: SessionEntry,
  entry: SessionEntry,
): PendingSessionOp {
  const undo: SessionPatch = {};
  for (const field of CLIENT_ENTRY_FIELDS) {
    undo[field] = previous[field] ?? null;
  }
  return {
    type: EDIT_ENTRY,
    payload: {entryId, ...entryFieldsPayload(entry)},
    patch: {entries: {[entryId]: entry}},
    undo: {entries: {[entryId]: undo}},
  };
}

/**
 * `delete_entry`. The server writes a tombstone and never removes the key
 * (RFC §4.3), and the local patch does the same, so a reader sees the same
 * shape before and after the round trip.
 */
function deleteEntryOp(
  entryId: SessionEntryId,
  previous: SessionEntry,
): PendingSessionOp {
  return {
    type: DELETE_ENTRY,
    payload: {entryId},
    patch: {entries: {[entryId]: {deleted: true}}},
    undo: {
      entries: {
        [entryId]: {deleted: null, edited_at: previous.edited_at ?? null},
      },
    },
  };
}

/**
 * The ops for a change to a session's entries, given the map before the change
 * and the entries that changed (what `DSUtils.modifySessionEntries` reports as
 * its `patch`). An id the map did not hold is an add, an id whose new value is
 * a tombstone is a delete, and anything else is an edit.
 */
function buildEntryPatchOps(
  before: SessionEntries | undefined,
  patch: SessionEntries,
): PendingSessionOp[] {
  const ops: PendingSessionOp[] = [];
  for (const [entryId, entry] of Object.entries(patch)) {
    const previous = before?.[entryId];
    if (!previous) {
      ops.push(addEntryOp(entryId, entry));
      continue;
    }
    if (entry.deleted === true && previous.deleted !== true) {
      ops.push(deleteEntryOp(entryId, previous));
      continue;
    }
    if (entryFieldsChanged(previous, entry)) {
      ops.push(editEntryOp(entryId, previous, entry));
    }
  }
  return ops;
}

/** The `start` payload for a session the server has never seen. */
function buildStartOp(session: DrinkingSession): PendingSessionOp {
  const payload: SessionOpPayload = {
    start_time: session.start_time,
    end_time: session.end_time,
  };
  if (session.timezone) {
    payload.timezone = session.timezone;
  }
  if (session.type) {
    payload.type = session.type;
  }
  if (session.name !== undefined) {
    payload.name = session.name;
  }
  if (session.visibility !== undefined) {
    payload.visibility = session.visibility;
  }
  if (session.note !== undefined) {
    payload.note = session.note;
  }
  if (session.blackout !== undefined) {
    payload.blackout = session.blackout;
  }
  return {
    type: START,
    payload,
    patch: {},
    undo: {},
  };
}

/** `set_note`, with the note it replaces as its undo. */
function buildSetNoteOp(previous: string, note: string): PendingSessionOp {
  return {
    type: SET_NOTE,
    payload: {note},
    patch: {note},
    undo: {note: previous},
  };
}

/** `set_blackout`. */
function buildSetBlackoutOp(
  previous: boolean,
  blackout: boolean,
): PendingSessionOp {
  return {
    type: SET_BLACKOUT,
    payload: {blackout},
    patch: {blackout},
    undo: {blackout: previous},
  };
}

/** `set_visibility`. */
function buildSetVisibilityOp(
  previous: DrinkingSession['visibility'],
  visibility: NonNullable<DrinkingSession['visibility']>,
): PendingSessionOp {
  return {
    type: SET_VISIBILITY,
    payload: {visibility},
    patch: {visibility},
    undo: {visibility: previous ?? null},
  };
}

/** `rename`. */
function buildRenameOp(
  previous: DrinkingSession['name'],
  name: string,
): PendingSessionOp {
  return {
    type: RENAME,
    payload: {name},
    patch: {name},
    undo: {name: previous ?? null},
  };
}

/**
 * `set_times`: the session's start, end and (when it changed) its timezone.
 * One op rather than three, because they answer one question: when the session
 * happened, and on what clock.
 */
function buildSetTimesOp(
  stored: DrinkingSession,
  edited: DrinkingSession,
): PendingSessionOp {
  const payload: SessionOpPayload = {
    start_time: edited.start_time,
    end_time: edited.end_time,
  };
  const patch: SessionPatch = {
    start_time: edited.start_time,
    end_time: edited.end_time,
  };
  const undo: SessionPatch = {
    start_time: stored.start_time,
    end_time: stored.end_time,
  };
  if (edited.timezone && edited.timezone !== stored.timezone) {
    payload.timezone = edited.timezone;
    patch.timezone = edited.timezone;
    undo.timezone = stored.timezone ?? null;
  }
  return {type: SET_TIMES, payload, patch, undo};
}

/** `end`, closing the session at `end_time`. */
function buildEndOp(
  stored: DrinkingSession,
  edited: DrinkingSession,
): PendingSessionOp {
  return {
    type: END,
    payload: {end_time: edited.end_time},
    patch: {ongoing: false, end_time: edited.end_time},
    undo: {ongoing: stored.ongoing ?? null, end_time: stored.end_time},
  };
}

function timesChanged(stored: DrinkingSession, edited: DrinkingSession) {
  return (
    stored.start_time !== edited.start_time ||
    stored.end_time !== edited.end_time ||
    (!!edited.timezone && edited.timezone !== stored.timezone)
  );
}

/** The meta ops for the difference between two versions of a session. */
function buildMetaDiffOps(
  stored: DrinkingSession,
  edited: DrinkingSession,
): PendingSessionOp[] {
  const ops: PendingSessionOp[] = [];
  if (timesChanged(stored, edited)) {
    ops.push(buildSetTimesOp(stored, edited));
  }
  if (edited.name !== undefined && edited.name !== stored.name) {
    ops.push(buildRenameOp(stored.name, edited.name));
  }
  if ((edited.note ?? '') !== (stored.note ?? '')) {
    ops.push(buildSetNoteOp(stored.note ?? '', edited.note ?? ''));
  }
  if (!!edited.blackout !== !!stored.blackout) {
    ops.push(buildSetBlackoutOp(!!stored.blackout, !!edited.blackout));
  }
  if (
    edited.visibility !== undefined &&
    edited.visibility !== stored.visibility
  ) {
    ops.push(buildSetVisibilityOp(stored.visibility, edited.visibility));
  }
  return ops;
}

/** The entry ops for the difference between two versions of a session. */
function buildEntryDiffOps(
  stored: DrinkingSession,
  edited: DrinkingSession,
): PendingSessionOp[] {
  const before = stored.entries ?? {};
  const after = edited.entries ?? {};
  const ops: PendingSessionOp[] = [];
  for (const [entryId, entry] of Object.entries(after)) {
    const previous = before[entryId];
    if (!previous) {
      // A tombstone the server has never seen stands for nothing: the drink
      // was added and removed again before the save, so there is nothing to
      // add and nothing to delete.
      if (entry.deleted !== true) {
        ops.push(addEntryOp(entryId, entry));
      }
      continue;
    }
    if (entry.deleted === true && previous.deleted !== true) {
      ops.push(deleteEntryOp(entryId, previous));
      continue;
    }
    if (entry.deleted !== true && entryFieldsChanged(previous, entry)) {
      ops.push(editEntryOp(entryId, previous, entry));
    }
  }
  // An entry the edited session dropped entirely is a delete: the map should
  // keep the key (RFC §4.3), but a caller that rebuilt the map without it
  // still means "this drink is gone".
  for (const [entryId, previous] of Object.entries(before)) {
    if (!after[entryId] && previous.deleted !== true) {
      ops.push(deleteEntryOp(entryId, previous));
    }
  }
  return ops;
}

/**
 * The ops that turn `stored` (what the server has) into `edited` (what the
 * user wants). `stored` is `undefined` for a session the server has never
 * seen, which becomes one `start` carrying all of its meta plus an
 * `add_entry` per drink.
 *
 * The order matters: meta first, then entries, then `end`. A `set_times` that
 * widens the session comes before the entries that fall inside the new window,
 * and `end` comes last so the session is only closed once everything in it has
 * been sent.
 */
function buildSessionDiffOps(
  stored: DrinkingSession | undefined,
  edited: DrinkingSession,
  options: SessionDiffOptions = {},
): PendingSessionOp[] {
  const {shouldIncludeEntries = true, shouldIncludeEnd = true} = options;
  const ops: PendingSessionOp[] = [];
  if (!stored) {
    // `start` stamps `ongoing` from the session's own type, so a session
    // created as an edit session arrives closed and needs no `end`.
    ops.push(buildStartOp(edited));
    if (shouldIncludeEntries) {
      for (const [entryId, entry] of Object.entries(edited.entries ?? {})) {
        if (entry.deleted !== true) {
          ops.push(addEntryOp(entryId, entry));
        }
      }
    }
    return ops;
  }
  ops.push(...buildMetaDiffOps(stored, edited));
  if (shouldIncludeEntries) {
    ops.push(...buildEntryDiffOps(stored, edited));
  }
  if (shouldIncludeEnd && stored.ongoing === true && edited.ongoing !== true) {
    ops.push(buildEndOp(stored, edited));
  }
  return ops;
}

export {
  buildEntryPatchOps,
  buildSessionDiffOps,
  buildSetBlackoutOp,
  buildSetNoteOp,
  buildSetTimesOp,
  buildSetVisibilityOp,
  buildRenameOp,
};
export type {PendingSessionOp, SessionDiffOptions, SessionPatch};
