import Foundation

/// The watch's queue of session ops waiting to reach the server: in order,
/// one at a time, retried until they land.
///
/// **Why the watch needs one at all.** The old whole-session PUT could be
/// dropped on failure without losing anything, because the authoritative save
/// re-sent the entire session (see ``LiveUpdateCoalescer``). An op cannot be
/// dropped that way: it is a delta, so a lost `add_entry` is a lost drink and
/// nothing later re-sends it. The phone gets this for free from Onyx's
/// persisted `SequentialQueue`; the watch has no such thing, so this is its
/// miniature, with the same two rules that matter:
///
///   - **In order, single-flight.** At most one op is on the wire. Ops are
///     applied in the order the user made them, so an `edit_entry` can never
///     overtake the `add_entry` it edits.
///   - **Retry the transient, drop the deterministic.** A network blip or a 5xx
///     keeps the op queued and backs off. A non-retryable 4xx means the server
///     actively refused this exact payload, so replaying it can never succeed
///     and it is dropped rather than blocking every op behind it forever. This
///     is the same split the app's queue makes (`isDroppableFailure`).
///
/// Pure and `Codable`: it holds no timer and does no networking, so the view
/// model can persist it (a watch app relaunch must not lose queued drinks) and
/// so the sequencing is host-unit-testable via `swift test`.
public final class SessionOpOutbox {
    /// What the caller must do next.
    public enum Command: Equatable, Sendable {
        /// Nothing to do; the outbox is idle or already waiting.
        case none
        /// Send this op now, then report the outcome via ``sendCompleted(_:)``.
        case send(SessionOp)
        /// Wait this long, then call ``retryTimerFired(generation:)`` with this
        /// `generation`. A newer enqueue supersedes it.
        case scheduleRetry(generation: Int, delayMillis: Int)
    }

    /// How a send ended.
    public enum Outcome: Equatable, Sendable {
        /// The server applied it (or answered a replay from its record).
        case success
        /// The server refused this exact payload (a non-retryable 4xx). Replaying
        /// it can never succeed, so it is dropped.
        case refused
        /// A network failure, a timeout or a 5xx. Worth retrying.
        case transient
    }

    /// The ops still to send, oldest first.
    public private(set) var pending: [SessionOp] = []

    /// Ops the server refused, kept for the caller to report or log. Bounded:
    /// only the most recent few are of any use.
    public private(set) var refused: [SessionOp] = []

    private let baseRetryMillis: Int
    private let maxRetryMillis: Int
    private let maxRefusedKept: Int

    /// An op is on the wire (single-flight guard).
    private var isSending = false
    /// Consecutive transient failures, for the backoff.
    private var transientFailures = 0
    /// Bumped whenever the schedule changes, so a stale retry fire is ignored.
    private var retryGeneration = 0

    /// - Parameters:
    ///   - baseRetryMillis: the first backoff after a transient failure.
    ///   - maxRetryMillis: the backoff ceiling, so a long outage settles into
    ///     an occasional retry rather than a tight loop on a watch battery.
    ///   - maxRefusedKept: how many refused ops to remember.
    public init(
        baseRetryMillis: Int = 2_000,
        maxRetryMillis: Int = 60_000,
        maxRefusedKept: Int = 10
    ) {
        self.baseRetryMillis = baseRetryMillis
        self.maxRetryMillis = maxRetryMillis
        self.maxRefusedKept = maxRefusedKept
    }

    /// Whether anything is queued or in flight. Save/discard uses this to know
    /// the server may not yet reflect the latest drinks.
    public var hasPendingWork: Bool { !pending.isEmpty || isSending }

    /// How many ops are waiting, in flight excluded.
    public var pendingCount: Int { pending.count }

    // MARK: - Driving

    /// Queue one op. Sends it straight away when nothing is on the wire,
    /// otherwise it waits its turn.
    public func enqueue(_ op: SessionOp) -> Command {
        pending.append(op)
        // A fresh op means the caller is online-ish and trying again, so cancel
        // any armed backoff and go now: waiting out a stale 60 s ceiling after
        // the user taps again would feel broken.
        transientFailures = 0
        retryGeneration += 1
        return sendNextIfIdle()
    }

    /// Report the outcome of the op the outbox last handed out.
    public func sendCompleted(_ outcome: Outcome) -> Command {
        guard isSending else {
            return .none
        }
        isSending = false
        switch outcome {
        case .success:
            transientFailures = 0
            if !pending.isEmpty {
                pending.removeFirst()
            }
            return sendNextIfIdle()
        case .refused:
            // The server will refuse it again, so it must not block the ops
            // behind it. Remember it and move on.
            if !pending.isEmpty {
                let dropped = pending.removeFirst()
                refused.append(dropped)
                if refused.count > maxRefusedKept {
                    refused.removeFirst(refused.count - maxRefusedKept)
                }
            }
            transientFailures = 0
            return sendNextIfIdle()
        case .transient:
            // Keep it at the head and back off; the drink it carries is not
            // recorded anywhere else.
            transientFailures += 1
            retryGeneration += 1
            return .scheduleRetry(
                generation: retryGeneration,
                delayMillis: retryDelayMillis()
            )
        }
    }

    /// A retry timer fired. Ignored when a newer enqueue or failure superseded
    /// it; otherwise the head op goes out again.
    public func retryTimerFired(generation: Int) -> Command {
        guard generation == retryGeneration else {
            return .none
        }
        return sendNextIfIdle()
    }

    /// Resume after a relaunch or a reconnect: send the head op if there is one.
    /// Idempotent, so the caller can call it on every app activation.
    public func resume() -> Command {
        sendNextIfIdle()
    }

    /// Drop every queued op for `sessionId`, in flight excluded.
    ///
    /// Used when a session is discarded: the session is about to be deleted, so
    /// its queued drinks have nowhere to land, and sending them would either
    /// resurrect the session or pile up refusals.
    public func dropOps(forSessionId sessionId: String) {
        pending.removeAll { $0.sessionId == sessionId }
        retryGeneration += 1
    }

    /// Forget the refused ops the caller has now reported.
    public func clearRefused() {
        refused = []
    }

    // MARK: - Persistence

    /// The queue as it stands, for the caller to persist across launches.
    public func snapshot() -> [SessionOp] { pending }

    /// Restore a persisted queue. Replaces whatever is held; nothing is treated
    /// as in flight, because a send that was on the wire when the app died has
    /// an unknown outcome and its op id makes a resend safe (the server answers
    /// a replay from its record).
    public func restore(_ ops: [SessionOp]) {
        pending = ops
        isSending = false
        transientFailures = 0
        retryGeneration += 1
    }

    // MARK: - Internals

    private func sendNextIfIdle() -> Command {
        guard !isSending, let next = pending.first else {
            return .none
        }
        isSending = true
        return .send(next)
    }

    /// Exponential backoff from `baseRetryMillis`, capped at `maxRetryMillis`.
    private func retryDelayMillis() -> Int {
        let exponent = max(0, transientFailures - 1)
        // Shift rather than `pow` to stay integral, and stop doubling once the
        // ceiling is reached so the shift cannot overflow on a long outage.
        if exponent >= 32 {
            return maxRetryMillis
        }
        let delay = baseRetryMillis << exponent
        return min(delay, maxRetryMillis)
    }
}
