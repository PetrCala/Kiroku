import XCTest
@testable import KirokuWatchCore

/// Phase 5 (docs/apple-watch-mvp.md) coverage for the debounce + single-flight
/// sequencer that coalesces rapid +/- taps into one `/v1/sessions/update` PUT.
/// The coalescer is a pure state machine, so the tests drive it by feeding the
/// events the view model's timer/network would (schedule / timerFired /
/// flushCompleted) and asserting the returned commands.
final class LiveUpdateCoalescerTests: XCTestCase {
    /// A single tap arms one timer; the timer firing flushes once.
    func testSingleTapDebouncesToOneFlush() {
        let coalescer = LiveUpdateCoalescer(debounceMillis: 500)

        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 1, delayMillis: 500))
        XCTAssertTrue(coalescer.hasPendingWork)
        XCTAssertEqual(coalescer.timerFired(generation: 1), .flush)
        XCTAssertEqual(coalescer.flushCompleted(success: true), .none)
        XCTAssertFalse(coalescer.hasPendingWork)
    }

    /// A burst of taps re-arms the timer each time; only the final generation's
    /// timer flushes, and the earlier (superseded) timers are ignored. One flush.
    func testBurstCoalescesIntoOneFlush() {
        let coalescer = LiveUpdateCoalescer(debounceMillis: 500)

        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 1, delayMillis: 500))
        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 2, delayMillis: 500))
        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 3, delayMillis: 500))

        // Stale timers (from the first two taps) fire late and do nothing.
        XCTAssertEqual(coalescer.timerFired(generation: 1), .none)
        XCTAssertEqual(coalescer.timerFired(generation: 2), .none)
        // Only the latest generation's timer flushes.
        XCTAssertEqual(coalescer.timerFired(generation: 3), .flush)
        XCTAssertEqual(coalescer.flushCompleted(success: true), .none)
    }

    /// A tap during an in-flight flush is remembered and flushed once the PUT
    /// resolves, never concurrently (single-flight). No overlapping flush.
    func testTapDuringFlightFlushesAgainAfterCompletion() {
        let coalescer = LiveUpdateCoalescer(debounceMillis: 500)

        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 1, delayMillis: 500))
        XCTAssertEqual(coalescer.timerFired(generation: 1), .flush)

        // A tap lands while the first PUT is still in flight.
        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 2, delayMillis: 500))
        // Its quiet window elapses mid-flight: cannot start a second PUT yet.
        XCTAssertEqual(coalescer.timerFired(generation: 2), .none)

        // On completion, the accumulated edit is flushed as one follow-up PUT.
        XCTAssertEqual(coalescer.flushCompleted(success: true), .flush)
        XCTAssertEqual(coalescer.flushCompleted(success: true), .none)
        XCTAssertFalse(coalescer.hasPendingWork)
    }

    /// A tap during flight whose quiet window has NOT elapsed by the time the PUT
    /// completes waits for its own timer rather than flushing early.
    func testTapDuringFlightWaitsForItsTimerWhenNotYetQuiet() {
        let coalescer = LiveUpdateCoalescer(debounceMillis: 500)

        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 1, delayMillis: 500))
        XCTAssertEqual(coalescer.timerFired(generation: 1), .flush)

        // Tap mid-flight, but its timer has not fired yet when the PUT resolves.
        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 2, delayMillis: 500))
        XCTAssertEqual(coalescer.flushCompleted(success: true), .none)
        XCTAssertTrue(coalescer.hasPendingWork, "the mid-flight edit is still pending")

        // When its own timer finally fires (no longer in flight), it flushes.
        XCTAssertEqual(coalescer.timerFired(generation: 2), .flush)
        XCTAssertEqual(coalescer.flushCompleted(success: true), .none)
    }

    /// A failed flush stays quiet: no auto-retry, but the edits remain pending so
    /// the next tap re-arms and the authoritative save re-sends the whole session.
    func testFailedFlushStaysQuietAndKeepsEditsPending() {
        let coalescer = LiveUpdateCoalescer(debounceMillis: 500)

        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 1, delayMillis: 500))
        XCTAssertEqual(coalescer.timerFired(generation: 1), .flush)

        // Edit arrives during the flight, then the PUT fails.
        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 2, delayMillis: 500))
        XCTAssertEqual(coalescer.flushCompleted(success: false), .none, "no immediate retry")
        XCTAssertTrue(coalescer.hasPendingWork)

        // A fresh quiet window (its re-armed timer) is what re-attempts the write.
        XCTAssertEqual(coalescer.timerFired(generation: 2), .flush)
    }

    /// Cancel drops pending edits and invalidates the armed timer, so a debounced
    /// update can never land after a save/discard.
    func testCancelInvalidatesArmedTimer() {
        let coalescer = LiveUpdateCoalescer(debounceMillis: 500)

        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 1, delayMillis: 500))
        coalescer.cancel()
        XCTAssertFalse(coalescer.hasPendingWork)
        // The timer armed before the cancel fires late and does nothing.
        XCTAssertEqual(coalescer.timerFired(generation: 1), .none)
    }

    /// A flush in flight when cancel is called does not spawn a follow-up flush
    /// on completion (the finalizing save/discard is now the source of truth).
    func testCancelDuringFlightSuppressesFollowUp() {
        let coalescer = LiveUpdateCoalescer(debounceMillis: 500)

        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 1, delayMillis: 500))
        XCTAssertEqual(coalescer.timerFired(generation: 1), .flush)
        // A tap lands mid-flight, then the user saves (cancel) before it resolves.
        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 2, delayMillis: 500))
        coalescer.cancel()

        XCTAssertEqual(coalescer.flushCompleted(success: true), .none)
        XCTAssertFalse(coalescer.hasPendingWork)
    }

    /// Taps after a full flush cycle start a fresh generation and flush again.
    func testSecondBurstAfterIdleFlushesAgain() {
        let coalescer = LiveUpdateCoalescer(debounceMillis: 500)

        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 1, delayMillis: 500))
        XCTAssertEqual(coalescer.timerFired(generation: 1), .flush)
        XCTAssertEqual(coalescer.flushCompleted(success: true), .none)

        // A brand new burst much later.
        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 2, delayMillis: 500))
        XCTAssertEqual(coalescer.timerFired(generation: 2), .flush)
        XCTAssertEqual(coalescer.flushCompleted(success: true), .none)
    }

    /// The debounce window is configurable and reported back in the command.
    func testCustomDebounceWindowIsReported() {
        let coalescer = LiveUpdateCoalescer(debounceMillis: 250)
        XCTAssertEqual(coalescer.schedule(), .scheduleTimer(generation: 1, delayMillis: 250))
    }
}
