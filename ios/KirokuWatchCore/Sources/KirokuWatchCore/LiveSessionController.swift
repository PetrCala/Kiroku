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
///   - **Watch owns its own unit bucket.** `+`/`−` only ever touch one
///     timestamp bucket the watch picks when the session becomes active, so a
///     watch subtraction can never delete a drink the phone logged; adopted
///     phone drinks stay intact and still count toward the displayed total.
///
/// It performs no networking and holds no credential; the view model reads
/// ``currentSession()`` / ``makeFinalized()`` and POSTs via `KirokuAPI`, then
/// calls ``markFinished()`` on success. Keeping the state transitions here (and
/// off the main actor and WatchKit) is what makes them host-unit-testable.
public final class LiveSessionController {
    /// The live session being logged, or `nil` when idle (no active session).
    public private(set) var liveSession: DrinkingSession?

    /// The timestamp-millisecond bucket the watch's `+`/`−` operate on. Chosen
    /// when a session becomes active so watch units layer onto their own bucket,
    /// distinct from any drinks an adopted phone session already carries.
    private var unitBucketMillis: Int?

    /// Ids of sessions already saved/discarded from the watch, so a stale phone
    /// snapshot of one can't be re-adopted after the watch went idle.
    private var finishedIds: Set<String> = []

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
    @discardableResult
    public func begin(
        adopting ongoing: DrinkingSession?,
        newId: String,
        now: Int = DrinkingSession.nowMillis(),
        timezone: String = TimeZone.current.identifier
    ) -> DrinkingSession {
        let session: DrinkingSession
        if let ongoing, ongoing.ongoing, !finishedIds.contains(ongoing.id) {
            session = ongoing
        } else {
            session = DrinkingSession.newLive(id: newId, now: now, timezone: timezone)
        }
        setActive(session, bucketMillis: now)
        return session
    }

    /// Add one unit of `key` to the watch's own bucket. Returns whether the state
    /// changed (always `true` while active), so the caller can gate a haptic.
    @discardableResult
    public func addUnit(of key: DrinkKey = .other) -> Bool {
        guard var session = liveSession, let bucket = unitBucketMillis else {
            return false
        }
        session.addDrinks(1, of: key, atMillis: bucket)
        liveSession = session
        return true
    }

    /// Remove one unit of `key` from the watch's own bucket. Returns `false`
    /// (no haptic) when there is nothing the watch itself added to remove; a
    /// watch subtraction never deletes a drink the phone logged.
    @discardableResult
    public func subtractUnit(of key: DrinkKey = .other) -> Bool {
        guard var session = liveSession, let bucket = unitBucketMillis else {
            return false
        }
        let owned = session.drinks?[String(bucket)]?[key.rawValue] ?? 0
        guard owned > 0 else {
            return false
        }
        session.addDrinks(-1, of: key, atMillis: bucket)
        liveSession = session
        return true
    }

    /// The session to POST when saving: a copy marked ended (`ongoing == false`,
    /// `end_time == now`). State is left untouched so a failed save can be
    /// retried; call ``markFinished()`` only once the write succeeds.
    public func makeFinalized(now: Int = DrinkingSession.nowMillis()) -> DrinkingSession? {
        guard var session = liveSession else {
            return nil
        }
        session.ongoing = false
        session.endTime = now
        return session
    }

    /// Clear local state after a successful save or discard, remembering the id
    /// so a lagging phone snapshot of it isn't re-adopted (see ``reflectOngoing``).
    public func markFinished() {
        if let id = liveSession?.id {
            finishedIds.insert(id)
        }
        liveSession = nil
        unitBucketMillis = nil
    }

    // MARK: - Internals

    private func setActive(_ session: DrinkingSession, bucketMillis: Int) {
        liveSession = session
        unitBucketMillis = bucketMillis
    }
}
