import Foundation

/// The pure (Foundation-only) sequencer behind the watch's debounced live-session
/// update posts (Apple Watch MVP, Phase 5; docs/apple-watch-mvp.md).
///
/// Rapid `+`/`−` taps must not each fire their own `/v1/sessions/update` PUT.
/// That would spam the API and, worse, let two whole-session writes race and
/// arrive out of order: because the endpoint is last-writer-wins on the whole
/// session, a slower earlier PUT landing last would overwrite newer drinks. This
/// mirrors the phone app's debounced live persist (`LIVE_SESSION_PERSIST_DEBOUNCE_MS`,
/// 500ms in `src/libs/actions/DrinkingSession.ts`):
///
///   - **Debounce.** Each tap re-arms a quiet-window timer, so a burst of taps
///     coalesces into a single update once the user pauses.
///   - **Single-flight.** At most one update PUT is ever outstanding. A tap that
///     arrives while a PUT is in flight is remembered and flushed once, after
///     that PUT resolves, never concurrently, so PUTs can never overlap or land
///     out of order.
///
/// It is intentionally pure: it holds no session, owns no timer, and does no
/// networking. It only decides *what the caller should do next* by returning a
/// ``Command``. The `@MainActor` view model owns the real `Task.sleep` timer and
/// the `KirokuAPI` call, and reads the latest session at flush time (so the newest
/// drinks are always sent, exactly like the app reading `ONGOING_SESSION_DATA` at
/// flush time). Keeping the sequencing here, off the main actor and WatchKit, is
/// what makes it host-unit-testable via `swift test`.
public final class LiveUpdateCoalescer {
    /// What the caller must do in response to an event.
    public enum Command: Equatable, Sendable {
        /// Nothing to do.
        case none
        /// Arm a one-shot timer for `delayMillis`. When it fires, call
        /// ``timerFired(generation:)`` with this `generation`. A later
        /// ``schedule()`` supersedes it: the stale timer's `timerFired` is ignored.
        case scheduleTimer(generation: Int, delayMillis: Int)
        /// Send one update PUT now with the latest session, then report the
        /// outcome via ``flushCompleted(success:)``.
        case flush
    }

    private let debounceMillis: Int
    /// Local edits not yet acknowledged by a completed flush.
    private var pendingDirty = false
    /// The debounce quiet window has elapsed for the pending edits.
    private var quietWindowElapsed = false
    /// An update PUT is in flight (single-flight guard).
    private var isFlushing = false
    /// Bumped on every `schedule()`/`cancel()` so a stale timer fire is ignored.
    private var timerGeneration = 0

    /// - Parameter debounceMillis: the quiet window a burst of taps coalesces
    ///   into one write. Defaults to 500ms to match the phone app.
    public init(debounceMillis: Int = 500) {
        self.debounceMillis = debounceMillis
    }

    /// Whether the server may not yet reflect the latest local drinks (a write
    /// is in flight or edits are still waiting to be sent). Save/discard uses this
    /// only for reasoning; it always ``cancel()``s and then sends authoritatively.
    public var hasPendingWork: Bool { pendingDirty || isFlushing }

    /// Record a `+`/`−` edit. (Re)arms the quiet-window timer so a burst of taps
    /// coalesces into a single update.
    public func schedule() -> Command {
        pendingDirty = true
        quietWindowElapsed = false
        timerGeneration += 1
        return .scheduleTimer(generation: timerGeneration, delayMillis: debounceMillis)
    }

    /// A scheduled timer fired. Ignored (returns ``Command/none``) when a newer
    /// ``schedule()`` has superseded it; otherwise the quiet window has elapsed,
    /// so flush if nothing is already in flight.
    public func timerFired(generation: Int) -> Command {
        guard generation == timerGeneration else {
            return .none
        }
        quietWindowElapsed = true
        return startFlushIfReady()
    }

    /// The update PUT resolved. On success, flush again when edits arrived while
    /// it was in flight and their quiet window has already elapsed; otherwise wait
    /// for the pending timer (or go idle). On failure, stay quiet: keep the dirty
    /// edits so the next tap re-arms and the authoritative save re-sends the whole
    /// session, but do not auto-retry (background sync errors are silent).
    public func flushCompleted(success: Bool) -> Command {
        isFlushing = false
        guard success else {
            // A superseding tap may already have re-armed the timer; require that
            // fresh quiet window rather than retrying this failed body immediately.
            quietWindowElapsed = false
            return .none
        }
        return startFlushIfReady()
    }

    /// Drop all pending work and invalidate any armed timer. Called when the
    /// session ends (save/discard) or is abandoned, so a debounced update can
    /// never land after the finalizing write.
    public func cancel() {
        pendingDirty = false
        quietWindowElapsed = false
        isFlushing = false
        timerGeneration += 1
    }

    private func startFlushIfReady() -> Command {
        guard pendingDirty, quietWindowElapsed, !isFlushing else {
            return .none
        }
        // The pending edits are about to be sent; a tap during the flight will
        // re-arm and set these again for the next flush.
        pendingDirty = false
        quietWindowElapsed = false
        isFlushing = true
        return .flush
    }
}
