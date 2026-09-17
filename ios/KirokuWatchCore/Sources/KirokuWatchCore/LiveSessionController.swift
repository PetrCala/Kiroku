import Foundation

/// The pure (Foundation-only) state machine behind the watch's live-session UI
/// (Apple Watch MVP, Phase 4; docs/apple-watch-mvp.md). It owns the single
/// source of truth (one optional ``DrinkingSession``) and the rules the SwiftUI
/// view model wraps:
///
///   - **Reflect the phone.** When the watch is idle it adopts the ongoing
///     session the phone bridges over (``reflectOngoing(_:)``), so opening the
///     watch app while a session is live on the phone shows that session.
///   - **No bounce after finishing.** A saved/discarded session's id is
///     remembered so a lagging phone snapshot of the just-finished session isn't
///     re-adopted straight back into the UI.
///   - **Watch owns its own drinks.** On a Sessions v2 session every `+`
///     appends an entry authored by the watch (`source: watch`) and `−` only
///     tombstones or reduces entries the watch itself added in this run.
///     On a legacy session there are no entry ids to own, so `+`/`−` fall back
///     to one timestamp bucket the watch picks when the session becomes active.
///     Either way a watch subtraction can never delete a drink the phone
///     logged; adopted phone drinks stay intact and still count toward the
///     displayed total.
///
///   - **A v2 session records the ops its changes imply.** Each mutation
///     appends to ``takePendingOps()``, which the view model drains into
///     ``SessionOpOutbox``. That is what retires the whole-session PUT, and
///     with it the watch/phone overwrite race: the watch's writes name only its
///     own entry keys, so the phone's drinks are untouchable by construction
///     rather than by the bucket workaround's convention.
///
/// It performs no networking and holds no credential; the view model reads
/// ``currentSession()`` / ``makeFinalized()`` / ``takePendingOps()`` and POSTs
/// via `KirokuAPI`, then calls ``markFinished()`` on success. Keeping the state
/// transitions here (and off the main actor and WatchKit) is what makes them
/// host-unit-testable.
public final class LiveSessionController {
    /// The live session being logged, or `nil` when idle (no active session).
    public private(set) var liveSession: DrinkingSession?

    /// LEGACY ONLY. The timestamp-millisecond bucket the watch's `+`/`−`
    /// operate on in a legacy session, chosen when the session becomes active
    /// so watch units layer onto their own bucket rather than onto the phone's.
    ///
    /// It is a workaround for buckets having no identity: the watch cannot name
    /// a drink, so it claims a timestamp no one else is writing to and hopes.
    /// A Sessions v2 session needs none of it, because every drink is an entry
    /// with an id, and this field stays `nil` for one.
    private var unitBucketMillis: Int?

    /// The ids of the entries this watch added to the active Sessions v2
    /// session, oldest first. `−` only ever touches these.
    private var watchEntryIds: [String] = []

    /// Ids of sessions already saved/discarded from the watch, so a stale phone
    /// snapshot of one can't be re-adopted after the watch went idle.
    private var finishedIds: Set<String> = []

    /// Ops recorded for a Sessions v2 session since the last drain, oldest
    /// first. Empty on a legacy session, which writes whole sessions.
    private var pendingOps: [SessionOp] = []

    public init(liveSession: DrinkingSession? = nil) {
        self.liveSession = liveSession
    }

    // MARK: - Derived state

    /// Whether a live session is in progress (drives the session vs. start UI).
    public var isActive: Bool { liveSession != nil }

    /// The total units to display: every drink in the session (adopted phone
    /// drinks plus watch-added units).
    public var unitCount: Int { liveSession?.totalUnits ?? 0 }

    /// The session as it currently stands, for reads (e.g. to `discard` by id).
    public func currentSession() -> DrinkingSession? { liveSession }

    // MARK: - Adoption

    /// Adopt the phone's ongoing session when the watch is idle. No-op (returns
    /// `false`) when a session is already active, when there is nothing ongoing,
    /// or when the snapshot is one this watch just finished. Returns whether the
    /// controller adopted (so the caller can refresh published state).
    @discardableResult
    public func reflectOngoing(
        _ session: DrinkingSession?,
        now: Int = DrinkingSession.nowMillis()
    ) -> Bool {
        guard liveSession == nil,
              let session,
              session.ongoing,
              !finishedIds.contains(session.id) else {
            return false
        }
        setActive(session, bucketMillis: now)
        return true
    }

    // MARK: - Lifecycle

    /// Begin a live session from the watch. Adopts the phone's ongoing session id
    /// when one is present (so watch taps land in the same session, no
    /// duplicate); otherwise mints a fresh session with `newId`. Returns the
    /// session to POST as the start of the session.
    ///   - schemaV2: when minting a fresh session, make it a Sessions v2 one
    ///     (the phone's `SESSIONS_V2_SCHEMA` flag, bridged as `sessionsV2Schema`).
    @discardableResult
    public func begin(
        adopting ongoing: DrinkingSession?,
        newId: String,
        now: Int = DrinkingSession.nowMillis(),
        timezone: String = TimeZone.current.identifier,
        schemaV2: Bool = false
    ) -> DrinkingSession {
        let session: DrinkingSession
        let isFresh: Bool
        if let ongoing, ongoing.ongoing, !finishedIds.contains(ongoing.id) {
            session = ongoing
            isFresh = false
        } else {
            session = DrinkingSession.newLive(id: newId, now: now, timezone: timezone, schemaV2: schemaV2)
            isFresh = true
        }
        setActive(session, bucketMillis: now)
        // Only a session the watch minted needs a `start`: one adopted from the
        // phone already exists on the server, and `start` against it would be a
        // no-op the server answers from the session it already has.
        if isFresh, session.isSchemaV2 {
            pendingOps.append(SessionOp.start(session, now: now))
        }
        return session
    }

    /// Add one unit of `key`: to the watch's own bucket on a legacy session, or
    /// as a new entry authored by `authorUid` (the signed-in uid) on a Sessions
    /// v2 session. Returns whether the state changed, so the caller can gate a
    /// haptic; `false` on a v2 session without an author to attribute to.
    @discardableResult
    public func addUnit(
        of key: DrinkKey = .other,
        authorUid: String? = nil,
        now: Int = DrinkingSession.nowMillis(),
        entryId: String = PushID.generate()
    ) -> Bool {
        guard var session = liveSession else {
            return false
        }
        if session.isSchemaV2 {
            guard let authorUid, !authorUid.isEmpty else {
                return false
            }
            let entry = SessionEntry(
                ts: now,
                key: key.rawValue,
                count: 1,
                source: SessionEntry.watchSource,
                authorUid: authorUid,
                targetUid: authorUid,
                createdAt: now
            )
            session.addEntry(entry, id: entryId)
            watchEntryIds.append(entryId)
            pendingOps.append(
                SessionOp.addEntry(
                    sessionId: session.id,
                    entryId: entryId,
                    entry: entry,
                    now: now
                )
            )
        } else {
            guard let bucket = unitBucketMillis else {
                return false
            }
            session.addDrinks(1, of: key, atMillis: bucket)
        }
        liveSession = session
        return true
    }

    /// Remove one unit of `key` from what the watch itself added: the watch's
    /// bucket on a legacy session, or the newest live entry the watch logged on
    /// a Sessions v2 session (tombstoned when it held one drink, reduced
    /// otherwise). Returns `false` (no haptic) when there is nothing of the
    /// watch's own to remove; a watch subtraction never deletes a drink the
    /// phone logged.
    @discardableResult
    public func subtractUnit(of key: DrinkKey = .other, now: Int = DrinkingSession.nowMillis()) -> Bool {
        guard var session = liveSession else {
            return false
        }
        if session.isSchemaV2 {
            guard let ownId = watchEntryIds.last(where: { id in
                guard let entry = session.entries?[id] else { return false }
                return entry.isLive && entry.key == key.rawValue
            }), let entry = session.entries?[ownId] else {
                return false
            }
            if entry.count > 1 {
                session.reduceEntry(id: ownId, by: 1, atMillis: now)
                // Absolute: the count it must end up with, not "one fewer", so
                // a replayed op cannot reduce it twice.
                pendingOps.append(
                    SessionOp.editEntryCount(
                        sessionId: session.id,
                        entryId: ownId,
                        count: entry.count - 1,
                        now: now
                    )
                )
            } else {
                session.tombstoneEntry(id: ownId, atMillis: now)
                pendingOps.append(
                    SessionOp.deleteEntry(
                        sessionId: session.id,
                        entryId: ownId,
                        now: now
                    )
                )
            }
        } else {
            guard let bucket = unitBucketMillis else {
                return false
            }
            let owned = session.drinks?[String(bucket)]?[key.rawValue] ?? 0
            guard owned > 0 else {
                return false
            }
            session.addDrinks(-1, of: key, atMillis: bucket)
        }
        liveSession = session
        return true
    }

    /// The session to POST when saving a LEGACY session: a copy marked ended
    /// (`ongoing == false`, `end_time == now`). State is left untouched so a
    /// failed save can be retried; call ``markFinished()`` only once the write
    /// succeeds.
    ///
    /// A Sessions v2 session ends with ``makeEndOp(now:)`` instead: its drinks
    /// already reached the server as their own ops, so the close is one small
    /// op rather than a whole-session PUT that could overwrite whatever the
    /// phone logged in the meantime.
    public func makeFinalized(now: Int = DrinkingSession.nowMillis()) -> DrinkingSession? {
        guard var session = liveSession else {
            return nil
        }
        session.ongoing = false
        session.endTime = now
        return session
    }

    /// The `end` op that closes a Sessions v2 session, or `nil` when there is
    /// no live session or it is a legacy one (which saves through
    /// ``makeFinalized(now:)``).
    ///
    /// Also applied locally, so the controller's own copy reads as ended for
    /// the moment between the tap and the write landing.
    public func makeEndOp(now: Int = DrinkingSession.nowMillis()) -> SessionOp? {
        guard var session = liveSession, session.isSchemaV2 else {
            return nil
        }
        session.ongoing = false
        session.endTime = now
        liveSession = session
        return SessionOp.end(sessionId: session.id, endTime: now, now: now)
    }

    /// Take the ops recorded since the last drain, oldest first, and clear
    /// them. The view model hands these to ``SessionOpOutbox``; draining here
    /// keeps the controller from having to know whether a send succeeded.
    public func takePendingOps() -> [SessionOp] {
        let ops = pendingOps
        pendingOps = []
        return ops
    }

    /// Clear local state after a successful save or discard, remembering the id
    /// so a lagging phone snapshot of it isn't re-adopted (see ``reflectOngoing``).
    public func markFinished() {
        if let id = liveSession?.id {
            finishedIds.insert(id)
        }
        liveSession = nil
        unitBucketMillis = nil
        watchEntryIds = []
        pendingOps = []
    }

    // MARK: - Internals

    private func setActive(_ session: DrinkingSession, bucketMillis: Int) {
        liveSession = session
        // The bucket workaround is legacy-only now: a v2 session names its
        // drinks by entry id, so it never needs a timestamp to claim.
        unitBucketMillis = session.isSchemaV2 ? nil : bucketMillis
        watchEntryIds = []
        pendingOps = []
    }
}
