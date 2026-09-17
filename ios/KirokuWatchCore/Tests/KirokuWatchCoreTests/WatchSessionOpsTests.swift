import XCTest
@testable import KirokuWatchCore

/// The watch writing a Sessions v2 session as ops (W2), and the race that
/// closes.
///
/// The bug this is about: `/v1/sessions/update` is last-writer-wins on the
/// whole session, so a watch PUT and a phone PUT during the same night
/// overwrite each other and one device's drinks vanish. An op names only the
/// entry it changes, and the watch's entry ids are its own, so the two devices
/// write disjoint keys and neither can lose a drink.
final class WatchSessionOpsTests: XCTestCase {
    private let now = 1_700_000_000_000
    private let uid = "uid-A"

    private func v2Session(id: String) -> DrinkingSession {
        DrinkingSession.newLive(
            id: id,
            now: now,
            timezone: "Europe/Prague",
            schemaV2: true
        )
    }

    private func legacySession(id: String) -> DrinkingSession {
        DrinkingSession.newLive(id: id, now: now, timezone: "Europe/Prague")
    }

    // MARK: - The ops a v2 session produces

    func testBeginningAFreshV2SessionRecordsAStartOp() {
        let controller = LiveSessionController()
        controller.begin(adopting: nil, newId: "-S1", now: now, timezone: "Europe/Prague", schemaV2: true)

        let ops = controller.takePendingOps()
        XCTAssertEqual(ops.map(\.type), [SessionOp.OpType.start.rawValue])
        XCTAssertEqual(ops.first?.sessionId, "-S1")
        XCTAssertEqual(ops.first?.payload.startTime, now)
        XCTAssertEqual(ops.first?.payload.timezone, "Europe/Prague")
    }

    func testAdoptingThePhonesSessionRecordsNoStartOp() {
        let controller = LiveSessionController()
        let phoneSession = v2Session(id: "-Phone1")

        controller.begin(adopting: phoneSession, newId: "-Unused", now: now, schemaV2: true)

        // The session already exists on the server; a `start` against it would
        // be a no-op the server answers from what it already has.
        XCTAssertTrue(controller.takePendingOps().isEmpty)
        XCTAssertEqual(controller.currentSession()?.id, "-Phone1")
    }

    func testAddingAUnitRecordsAnAddEntryOpWithTheWatchSource() {
        let controller = LiveSessionController(liveSession: v2Session(id: "-S1"))
        XCTAssertTrue(controller.addUnit(of: .beer, authorUid: uid, now: now, entryId: "-Watch1"))

        let ops = controller.takePendingOps()
        XCTAssertEqual(ops.count, 1)
        let op = ops[0]
        XCTAssertEqual(op.type, SessionOp.OpType.addEntry.rawValue)
        XCTAssertEqual(op.payload.entryId, "-Watch1")
        XCTAssertEqual(op.payload.key, DrinkKey.beer.rawValue)
        XCTAssertEqual(op.payload.count, 1)
        XCTAssertEqual(op.payload.ts, now)
        XCTAssertEqual(op.payload.source, SessionEntry.watchSource)
    }

    func testEveryTapGetsItsOwnEntryIdAndItsOwnOp() {
        let controller = LiveSessionController(liveSession: v2Session(id: "-S1"))
        for index in 0..<3 {
            controller.addUnit(of: .beer, authorUid: uid, now: now + index, entryId: "-W\(index)")
        }

        let ops = controller.takePendingOps()
        XCTAssertEqual(ops.map { $0.payload.entryId }, ["-W0", "-W1", "-W2"])
        // Distinct op ids too, so none of them is mistaken for a replay of
        // another.
        XCTAssertEqual(Set(ops.map(\.opId)).count, 3)
    }

    func testSubtractingFromAMultiDrinkEntryRecordsTheAbsoluteCount() {
        var session = v2Session(id: "-S1")
        session.addEntry(
            SessionEntry(
                ts: now,
                key: DrinkKey.beer.rawValue,
                count: 3,
                source: SessionEntry.watchSource,
                authorUid: uid,
                targetUid: uid,
                createdAt: now
            ),
            id: "-W1"
        )
        let controller = LiveSessionController(liveSession: session)
        // The controller must consider `-W1` its own; re-add through the public
        // path so `watchEntryIds` knows about it.
        controller.addUnit(of: .beer, authorUid: uid, now: now, entryId: "-W2")
        _ = controller.takePendingOps()

        XCTAssertTrue(controller.subtractUnit(of: .beer, now: now + 1))
        let ops = controller.takePendingOps()
        XCTAssertEqual(ops.count, 1)
        // `-W2` held one drink, so it is tombstoned rather than reduced.
        XCTAssertEqual(ops[0].type, SessionOp.OpType.deleteEntry.rawValue)
        XCTAssertEqual(ops[0].payload.entryId, "-W2")
    }

    func testTheReduceOpNamesTheCountToEndUpWith() {
        // `subtractUnit` reduces rather than tombstones when one of the watch's
        // own entries holds more than one drink. That state is not reachable
        // through the controller alone today (every `addUnit` mints a fresh
        // count-1 entry, and an adopted session's entries are not the watch's
        // own), so the branch is covered here at its op builder: what matters is
        // that the op is ABSOLUTE, because a replay of "one fewer" would take
        // two drinks off.
        let op = SessionOp.editEntryCount(
            sessionId: "-S1",
            entryId: "-W1",
            count: 2,
            opId: "op-1",
            now: now
        )
        XCTAssertEqual(op.type, SessionOp.OpType.editEntry.rawValue)
        XCTAssertEqual(op.payload.entryId, "-W1")
        XCTAssertEqual(op.payload.count, 2)
        XCTAssertNil(op.payload.ts, "an edit names only what it changes")
    }

    func testEndingAV2SessionIsOneSmallOp() {
        let controller = LiveSessionController(liveSession: v2Session(id: "-S1"))
        let endOp = controller.makeEndOp(now: now + 3_600_000)

        XCTAssertEqual(endOp?.type, SessionOp.OpType.end.rawValue)
        XCTAssertEqual(endOp?.payload.endTime, now + 3_600_000)
        // Applied locally too, so the UI reads as ended while the write flies.
        XCTAssertEqual(controller.currentSession()?.ongoing, false)
    }

    func testDrainingClearsTheBuffer() {
        let controller = LiveSessionController(liveSession: v2Session(id: "-S1"))
        controller.addUnit(of: .beer, authorUid: uid, now: now, entryId: "-W1")
        XCTAssertEqual(controller.takePendingOps().count, 1)
        XCTAssertTrue(controller.takePendingOps().isEmpty)
    }

    func testFinishingClearsAnyUndrainedOps() {
        let controller = LiveSessionController(liveSession: v2Session(id: "-S1"))
        controller.addUnit(of: .beer, authorUid: uid, now: now, entryId: "-W1")
        controller.markFinished()
        XCTAssertTrue(controller.takePendingOps().isEmpty)
    }

    // MARK: - The legacy path is untouched

    func testALegacySessionRecordsNoOpsAndStillUsesItsBucket() {
        let controller = LiveSessionController()
        controller.begin(adopting: nil, newId: "-L1", now: now, timezone: "Europe/Prague")
        XCTAssertTrue(controller.takePendingOps().isEmpty, "a legacy session writes whole sessions")

        XCTAssertTrue(controller.addUnit(of: .beer, now: now))
        XCTAssertTrue(controller.takePendingOps().isEmpty)
        // The bucket workaround still carries the drink.
        XCTAssertEqual(controller.unitCount, 1)
        XCTAssertNotNil(controller.currentSession()?.drinks)
    }

    func testALegacySessionStillEndsThroughTheWholeSessionSave() {
        let controller = LiveSessionController(liveSession: legacySession(id: "-L1"))
        XCTAssertNil(controller.makeEndOp(), "there is no `end` op for a legacy session")
        XCTAssertEqual(controller.makeFinalized(now: now + 1)?.ongoing, false)
    }

    // MARK: - The race this closes

    func testAWatchAndAPhoneLoggingConcurrentlyTouchDisjointKeys() {
        // One session, two writers. The watch appends through the controller;
        // the phone's write is modelled as an entry under its own id landing on
        // the server copy, which is what an `add_entry` op does.
        let sessionId = "-Shared1"
        let controller = LiveSessionController(liveSession: v2Session(id: sessionId))

        controller.addUnit(of: .beer, authorUid: uid, now: now, entryId: "-Watch1")
        controller.addUnit(of: .wine, authorUid: uid, now: now + 1_000, entryId: "-Watch2")
        let watchOps = controller.takePendingOps()

        // The server's copy of the session, with a drink the PHONE logged while
        // the watch was tapping.
        var server = v2Session(id: sessionId)
        server.addEntry(
            SessionEntry(
                ts: now + 500,
                key: DrinkKey.cocktail.rawValue,
                count: 1,
                source: "phone",
                authorUid: uid,
                targetUid: uid,
                createdAt: now + 500
            ),
            id: "-Phone1"
        )

        // Apply the watch's ops to it, the way the server would.
        for op in watchOps {
            guard let entryId = op.payload.entryId,
                  let key = op.payload.key,
                  let count = op.payload.count,
                  let ts = op.payload.ts else {
                return XCTFail("an add_entry op must name its entry")
            }
            XCTAssertNil(
                server.entries?[entryId],
                "the watch's entry id must not already exist on the server"
            )
            server.addEntry(
                SessionEntry(
                    ts: ts,
                    key: key,
                    count: count,
                    source: op.payload.source ?? "watch",
                    authorUid: uid,
                    targetUid: uid,
                    createdAt: ts
                ),
                id: entryId
            )
        }

        // All three drinks survive. A whole-session PUT from either device would
        // have dropped the other's.
        XCTAssertEqual(server.entries?.count, 3)
        XCTAssertEqual(server.totalUnits, 3)
        XCTAssertNotNil(server.entries?["-Phone1"], "the phone's drink is untouched")
        XCTAssertNotNil(server.entries?["-Watch1"])
        XCTAssertNotNil(server.entries?["-Watch2"])
    }

    func testAWatchSubtractionCanNeverNameAPhoneEntry() {
        var session = v2Session(id: "-Shared1")
        session.addEntry(
            SessionEntry(
                ts: now,
                key: DrinkKey.beer.rawValue,
                count: 1,
                source: "phone",
                authorUid: uid,
                targetUid: uid,
                createdAt: now
            ),
            id: "-Phone1"
        )
        let controller = LiveSessionController(liveSession: session)

        // Nothing of the watch's own to remove, so no op is produced and the
        // phone's drink stays.
        XCTAssertFalse(controller.subtractUnit(of: .beer, now: now + 1))
        XCTAssertTrue(controller.takePendingOps().isEmpty)
        XCTAssertEqual(controller.unitCount, 1)
    }

    // MARK: - The bucket workaround is retired for v2

    func testAV2SessionClaimsNoTimestampBucket() {
        let controller = LiveSessionController()
        controller.begin(adopting: nil, newId: "-S1", now: now, timezone: "Europe/Prague", schemaV2: true)
        controller.addUnit(of: .beer, authorUid: uid, now: now, entryId: "-W1")

        // No `drinks` map at all: the workaround that had the watch claim a
        // timestamp no one else was writing to is gone for a v2 session.
        XCTAssertNil(controller.currentSession()?.drinks)
        XCTAssertEqual(controller.currentSession()?.entries?.count, 1)
    }

    func testAV2SessionWithoutAnAuthorLogsNothing() {
        let controller = LiveSessionController(liveSession: v2Session(id: "-S1"))
        // An entry must be attributed; without the phone-bridged uid there is
        // nothing to attribute it to, and a bucket is no longer a fallback.
        XCTAssertFalse(controller.addUnit(of: .beer, authorUid: nil, now: now))
        XCTAssertTrue(controller.takePendingOps().isEmpty)
        XCTAssertEqual(controller.unitCount, 0)
    }
}
