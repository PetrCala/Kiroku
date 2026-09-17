/**
 * The pure op builders (`@libs/SessionOpBuilders`): which ops a change to a
 * session becomes, what each op's payload names, and what its undo restores.
 *
 * Two properties are worth pinning here because the whole write protocol rests
 * on them (Sessions v2 RFC §5.1): every op is ABSOLUTE, naming the value a
 * field must end up with rather than a delta, and every op carries the undo
 * for its own change and nothing else.
 */
import {buildEntryPatchOps, buildSessionDiffOps} from '@libs/SessionOpBuilders';
import CONST from '@src/CONST';
import type {DrinkingSession} from '@src/types/onyx';
import type SessionEntries from '@src/types/onyx/SessionEntries';
import type {SessionEntry} from '@src/types/onyx/SessionEntries';

const UID = 'uid-A';
const START = 1_700_000_000_000;
const {
  START: START_OP,
  END,
  SET_TIMES,
  ADD_ENTRY,
  EDIT_ENTRY,
  DELETE_ENTRY,
  SET_NOTE,
  SET_BLACKOUT,
  SET_VISIBILITY,
  RENAME,
} = CONST.SESSION_OP.TYPE;

function entry(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    ts: START,
    key: 'beer',
    count: 1,
    source: CONST.SESSION.ENTRY_SOURCE.PHONE,
    author_uid: UID,
    target_uid: UID,
    created_at: START,
    ...overrides,
  };
}

function session(overrides: Partial<DrinkingSession> = {}): DrinkingSession {
  return {
    id: '-Nsession1',
    schema_version: CONST.SESSION.SCHEMA_VERSION,
    name: 'Friday evening',
    visibility: CONST.SESSION.VISIBILITY.FRIENDS,
    start_time: START,
    end_time: START,
    blackout: false,
    note: '',
    timezone: 'Europe/Prague',
    type: CONST.SESSION.TYPES.LIVE,
    ongoing: true,
    ...overrides,
  };
}

const types = (ops: Array<{type: string}>) => ops.map(op => op.type);

describe('buildEntryPatchOps', () => {
  it('turns a new entry into add_entry, naming every client field', () => {
    const patch: SessionEntries = {
      e1: entry({volume_ml: 500, abv: 0.05}),
    };
    const ops = buildEntryPatchOps(undefined, patch);

    expect(types(ops)).toEqual([ADD_ENTRY]);
    expect(ops[0].payload).toEqual({
      entryId: 'e1',
      source: CONST.SESSION.ENTRY_SOURCE.PHONE,
      ts: START,
      key: 'beer',
      count: 1,
      volume_ml: 500,
      abv: 0.05,
    });
    // The server owns these; a client naming them would be ignored anyway.
    expect(ops[0].payload).not.toHaveProperty('author_uid');
    expect(ops[0].payload).not.toHaveProperty('created_at');
  });

  it('undoes an add by dropping the entry, not by hollowing it out', () => {
    const ops = buildEntryPatchOps(undefined, {e1: entry()});
    expect(ops[0].patch).toEqual({entries: {e1: entry()}});
    expect(ops[0].undo).toEqual({entries: {e1: null}});
  });

  it('turns a reduced count into edit_entry and keeps the id', () => {
    const before: SessionEntries = {e1: entry({count: 3})};
    const ops = buildEntryPatchOps(before, {
      e1: entry({count: 1, edited_at: START + 5}),
    });

    expect(types(ops)).toEqual([EDIT_ENTRY]);
    expect(ops[0].payload).toEqual({
      entryId: 'e1',
      ts: START,
      key: 'beer',
      count: 1,
    });
    expect(ops[0].undo).toEqual({
      entries: {
        e1: {ts: START, key: 'beer', count: 3, volume_ml: null, abv: null},
      },
    });
  });

  it('turns an emptied entry into delete_entry', () => {
    const before: SessionEntries = {e1: entry()};
    const ops = buildEntryPatchOps(before, {
      e1: entry({deleted: true, edited_at: START + 5}),
    });

    expect(types(ops)).toEqual([DELETE_ENTRY]);
    expect(ops[0].payload).toEqual({entryId: 'e1'});
    // The key stays, as a tombstone, both on the server and locally (RFC §4.3).
    expect(ops[0].patch).toEqual({entries: {e1: {deleted: true}}});
    expect(ops[0].undo).toEqual({
      entries: {e1: {deleted: null, edited_at: null}},
    });
  });

  it('sends nothing when an entry in the patch did not actually change', () => {
    const before: SessionEntries = {e1: entry()};
    expect(buildEntryPatchOps(before, {e1: entry()})).toEqual([]);
  });

  it('sends one op per changed entry when a removal spans several', () => {
    const before: SessionEntries = {
      e1: entry({count: 2}),
      e2: entry({count: 2, ts: START + 60_000}),
    };
    const ops = buildEntryPatchOps(before, {
      e1: entry({count: 1, edited_at: START + 5}),
      e2: entry({count: 2, ts: START + 60_000, deleted: true}),
    });
    expect(types(ops)).toEqual([EDIT_ENTRY, DELETE_ENTRY]);
  });
});

describe('buildSessionDiffOps on a session the server has never seen', () => {
  it('becomes one start carrying the meta, plus an add per drink', () => {
    const edited = session({
      type: CONST.SESSION.TYPES.EDIT,
      ongoing: false,
      end_time: START + 3_600_000,
      note: 'a good night',
      blackout: true,
      entries: {e1: entry(), e2: entry({ts: START + 60_000})},
    });
    const ops = buildSessionDiffOps(undefined, edited);

    expect(types(ops)).toEqual([START_OP, ADD_ENTRY, ADD_ENTRY]);
    expect(ops[0].payload).toEqual({
      start_time: START,
      end_time: START + 3_600_000,
      timezone: 'Europe/Prague',
      type: CONST.SESSION.TYPES.EDIT,
      name: 'Friday evening',
      visibility: CONST.SESSION.VISIBILITY.FRIENDS,
      note: 'a good night',
      blackout: true,
    });
    // `start` stamps `ongoing` from the type, so an edit session needs no end.
    expect(types(ops)).not.toContain(END);
  });

  it('does not add a drink that was logged and removed before the save', () => {
    const edited = session({
      entries: {e1: entry({deleted: true}), e2: entry()},
    });
    const ops = buildSessionDiffOps(undefined, edited);
    expect(types(ops)).toEqual([START_OP, ADD_ENTRY]);
    expect(ops[1].payload).toMatchObject({entryId: 'e2'});
  });
});

describe('buildSessionDiffOps meta diff', () => {
  it('sends only what changed', () => {
    const stored = session();
    const ops = buildSessionDiffOps(stored, session({note: 'fun'}), {
      shouldIncludeEnd: false,
    });
    expect(types(ops)).toEqual([SET_NOTE]);
    expect(ops[0].payload).toEqual({note: 'fun'});
    expect(ops[0].undo).toEqual({note: ''});
  });

  it('sends nothing when nothing changed', () => {
    expect(buildSessionDiffOps(session(), session())).toEqual([]);
  });

  it('folds start, end and timezone into one set_times', () => {
    const stored = session();
    const ops = buildSessionDiffOps(
      stored,
      session({
        start_time: START - 86_400_000,
        end_time: START - 80_000_000,
        timezone: 'Asia/Tokyo',
      }),
      {shouldIncludeEnd: false},
    );
    expect(types(ops)).toEqual([SET_TIMES]);
    expect(ops[0].payload).toEqual({
      start_time: START - 86_400_000,
      end_time: START - 80_000_000,
      timezone: 'Asia/Tokyo',
    });
    expect(ops[0].undo).toEqual({
      start_time: START,
      end_time: START,
      timezone: 'Europe/Prague',
    });
  });

  it('leaves the timezone out of set_times when only the times moved', () => {
    const ops = buildSessionDiffOps(
      session(),
      session({end_time: START + 1000}),
      {shouldIncludeEnd: false},
    );
    expect(ops[0].payload).not.toHaveProperty('timezone');
  });

  it('covers rename, blackout and visibility', () => {
    const ops = buildSessionDiffOps(
      session(),
      session({
        name: 'Saturday brunch',
        blackout: true,
        visibility: CONST.SESSION.VISIBILITY.PRIVATE,
      }),
      {shouldIncludeEnd: false},
    );
    expect(types(ops)).toEqual([RENAME, SET_BLACKOUT, SET_VISIBILITY]);
  });

  it('orders meta before entries before end', () => {
    const stored = session({entries: {e1: entry()}});
    const ops = buildSessionDiffOps(
      stored,
      session({
        ongoing: false,
        end_time: START + 1000,
        note: 'fun',
        entries: {e1: entry(), e2: entry({ts: START + 500})},
      }),
    );
    // `set_times` first (the window the new drink falls inside), then the
    // drink, then the close.
    expect(types(ops)).toEqual([SET_TIMES, SET_NOTE, ADD_ENTRY, END]);
  });
});

describe('buildSessionDiffOps entry diff', () => {
  it('adds, edits and tombstones against the stored map', () => {
    const stored = session({
      entries: {
        kept: entry(),
        changed: entry({count: 1}),
        removed: entry(),
      },
    });
    const ops = buildSessionDiffOps(
      stored,
      session({
        entries: {
          kept: entry(),
          changed: entry({count: 4}),
          removed: entry({deleted: true}),
          added: entry({ts: START + 10}),
        },
      }),
      {shouldIncludeEnd: false},
    );
    expect(types(ops).sort()).toEqual(
      [ADD_ENTRY, DELETE_ENTRY, EDIT_ENTRY].sort(),
    );
  });

  it('treats an entry dropped from the map as a delete', () => {
    const stored = session({entries: {e1: entry()}});
    const ops = buildSessionDiffOps(stored, session({entries: {}}), {
      shouldIncludeEnd: false,
    });
    expect(types(ops)).toEqual([DELETE_ENTRY]);
    expect(ops[0].payload).toEqual({entryId: 'e1'});
  });

  it('leaves entries alone when asked to, for a live session save', () => {
    const stored = session({entries: {e1: entry()}});
    const ops = buildSessionDiffOps(
      stored,
      session({ongoing: false, entries: {e1: entry(), e2: entry()}}),
      {shouldIncludeEntries: false},
    );
    expect(types(ops)).toEqual([END]);
  });

  it('never re-deletes an entry that is already a tombstone', () => {
    const stored = session({entries: {e1: entry({deleted: true})}});
    const ops = buildSessionDiffOps(
      stored,
      session({entries: {e1: entry({deleted: true})}}),
      {shouldIncludeEnd: false},
    );
    expect(ops).toEqual([]);
  });
});

describe('buildSessionDiffOps end op', () => {
  it('closes a session that stopped being ongoing', () => {
    const ops = buildSessionDiffOps(
      session({ongoing: true}),
      session({ongoing: false, end_time: START + 7_200_000}),
    );
    expect(types(ops)).toEqual([SET_TIMES, END]);
    const endOp = ops[1];
    expect(endOp.payload).toEqual({end_time: START + 7_200_000});
    expect(endOp.patch).toEqual({ongoing: false, end_time: START + 7_200_000});
    expect(endOp.undo).toEqual({ongoing: true, end_time: START});
  });

  it('does not close a session that was already closed', () => {
    const ops = buildSessionDiffOps(
      session({ongoing: false}),
      session({ongoing: false}),
    );
    expect(ops).toEqual([]);
  });
});
