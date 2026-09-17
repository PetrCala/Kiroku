import XCTest
@testable import KirokuWatchCore

/// The watch's op queue (Sessions v2 W2).
///
/// The property that matters: an op is a DELTA, so a lost `add_entry` is a lost
/// drink and nothing later re-sends it. The old whole-session PUT could be
/// dropped on failure because the save re-sent everything; this cannot, so the
/// outbox has to keep a transient failure at the head and retry it, while still
/// dropping a payload the server deterministically refuses so it cannot block
/// every drink behind it forever.
final class SessionOpOutboxTests: XCTestCase {
    private func op(_ entryId: String, sessionId: String = "-S1") -> SessionOp {
        SessionOp.deleteEntry(
            sessionId: sessionId,
            entryId: entryId,
            opId: "op-\(entryId)",
            now: 1_700_000_000_000
        )
    }

    private func sentOp(_ command: SessionOpOutbox.Command) -> SessionOp? {
        guard case let .send(op) = command else { return nil }
        return op
    }

    // MARK: - Order and single flight

    func testFirstEnqueueSendsImmediately() {
        let outbox = SessionOpOutbox()
        XCTAssertEqual(sentOp(outbox.enqueue(op("e1")))?.opId, "op-e1")
        XCTAssertTrue(outbox.hasPendingWork)
    }

    func testSecondEnqueueWaitsForTheFirstToResolve() {
        let outbox = SessionOpOutbox()
        _ = outbox.enqueue(op("e1"))

        // Nothing goes out while one op is on the wire: an `edit_entry` must
        // never overtake the `add_entry` it edits.
        XCTAssertEqual(outbox.enqueue(op("e2")), .none)
        XCTAssertEqual(outbox.pendingCount, 2)

        XCTAssertEqual(sentOp(outbox.sendCompleted(.success))?.opId, "op-e2")
        XCTAssertEqual(outbox.pendingCount, 1)
    }

    func testDrainsInTheOrderTheOpsWereMade() {
        let outbox = SessionOpOutbox()
        var sent: [String] = []
        var command = outbox.enqueue(op("e1"))
        _ = outbox.enqueue(op("e2"))
        _ = outbox.enqueue(op("e3"))

        while let next = sentOp(command) {
            sent.append(next.opId)
            command = outbox.sendCompleted(.success)
        }

        XCTAssertEqual(sent, ["op-e1", "op-e2", "op-e3"])
        XCTAssertFalse(outbox.hasPendingWork)
    }

    // MARK: - Failure handling

    func testATransientFailureKeepsTheOpAndBacksOff() {
        let outbox = SessionOpOutbox(baseRetryMillis: 2_000, maxRetryMillis: 60_000)
        _ = outbox.enqueue(op("e1"))

        guard case let .scheduleRetry(generation, delay) = outbox.sendCompleted(.transient) else {
            return XCTFail("a transient failure must schedule a retry")
        }
        XCTAssertEqual(delay, 2_000)
        // The drink is not recorded anywhere else, so the op stays at the head.
        XCTAssertEqual(outbox.pendingCount, 1)
        XCTAssertEqual(sentOp(outbox.retryTimerFired(generation: generation))?.opId, "op-e1")
    }

    func testBackoffDoublesAndIsCapped() {
        let outbox = SessionOpOutbox(baseRetryMillis: 1_000, maxRetryMillis: 4_000)
        _ = outbox.enqueue(op("e1"))

        var delays: [Int] = []
        for _ in 0..<5 {
            guard case let .scheduleRetry(generation, delay) = outbox.sendCompleted(.transient) else {
                return XCTFail("expected a retry")
            }
            delays.append(delay)
            _ = outbox.retryTimerFired(generation: generation)
        }
        XCTAssertEqual(delays, [1_000, 2_000, 4_000, 4_000, 4_000])
    }

    func testARefusedOpIsDroppedSoTheQueueKeepsMoving() {
        let outbox = SessionOpOutbox()
        _ = outbox.enqueue(op("bad"))
        _ = outbox.enqueue(op("good"))

        // The server will refuse it again, so it must not block what is behind.
        XCTAssertEqual(sentOp(outbox.sendCompleted(.refused))?.opId, "op-good")
        XCTAssertEqual(outbox.refused.map(\.opId), ["op-bad"])
        XCTAssertEqual(outbox.pendingCount, 1)
    }

    func testRefusedOpsAreBounded() {
        let outbox = SessionOpOutbox(maxRefusedKept: 2)
        for index in 0..<4 {
            _ = outbox.enqueue(op("e\(index)"))
        }
        for _ in 0..<4 {
            _ = outbox.sendCompleted(.refused)
        }
        XCTAssertEqual(outbox.refused.map(\.opId), ["op-e2", "op-e3"])
    }

    func testAStaleRetryFireIsIgnored() {
        let outbox = SessionOpOutbox()
        _ = outbox.enqueue(op("e1"))
        guard case let .scheduleRetry(stale, _) = outbox.sendCompleted(.transient) else {
            return XCTFail("expected a retry")
        }

        // A fresh tap means the user is trying again: it supersedes the armed
        // backoff so the queue goes now rather than waiting out a stale ceiling.
        XCTAssertEqual(sentOp(outbox.enqueue(op("e2")))?.opId, "op-e1")
        XCTAssertEqual(outbox.retryTimerFired(generation: stale), .none)
    }

    func testSendCompletedWithoutAnInFlightOpIsANoOp() {
        let outbox = SessionOpOutbox()
        XCTAssertEqual(outbox.sendCompleted(.success), .none)
        XCTAssertEqual(outbox.pendingCount, 0)
    }

    // MARK: - Discard and persistence

    func testDropOpsForADiscardedSessionLeavesOtherSessionsAlone() {
        let outbox = SessionOpOutbox()
        _ = outbox.enqueue(op("e1", sessionId: "-Gone"))
        _ = outbox.enqueue(op("e2", sessionId: "-Gone"))
        _ = outbox.enqueue(op("e3", sessionId: "-Kept"))

        outbox.dropOps(forSessionId: "-Gone")

        // The session is about to be deleted, so its queued drinks have nowhere
        // to land; sending them would only pile up refusals.
        XCTAssertEqual(outbox.snapshot().map(\.opId), ["op-e3"])
    }

    func testRestoreResumesAQueuePersistedAcrossALaunch() {
        let outbox = SessionOpOutbox()
        _ = outbox.enqueue(op("e1"))
        _ = outbox.enqueue(op("e2"))
        let persisted = outbox.snapshot()
        XCTAssertEqual(persisted.count, 2)

        // A relaunch: nothing is in flight, because a send that was on the wire
        // when the app died has an unknown outcome. Resending is safe, since the
        // op id makes the server answer a replay from its record.
        let revived = SessionOpOutbox()
        revived.restore(persisted)
        XCTAssertEqual(sentOp(revived.resume())?.opId, "op-e1")
    }

    func testResumeIsIdempotentSoItCanRunOnEveryActivation() {
        let outbox = SessionOpOutbox()
        _ = outbox.enqueue(op("e1"))
        // One op already on the wire; resuming must not send it twice.
        XCTAssertEqual(outbox.resume(), .none)
    }

    func testResumeOnAnEmptyOutboxDoesNothing() {
        XCTAssertEqual(SessionOpOutbox().resume(), .none)
    }
}
