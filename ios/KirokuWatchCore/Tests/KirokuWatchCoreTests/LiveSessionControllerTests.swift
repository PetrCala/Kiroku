import XCTest
@testable import KirokuWatchCore

/// Phase 4 (docs/apple-watch-mvp.md) state-machine coverage: reflecting the
/// phone's ongoing session, watch-owned +/- units that never touch phone drinks,
/// finalize/finish, and the no-re-adopt-after-finish rule.
final class LiveSessionControllerTests: XCTestCase {
    private func ongoing(id: String, now: Int = 1_700_000_000_000) -> DrinkingSession {
        DrinkingSession.newLive(id: id, now: now, timezone: "Europe/Prague")
    }

    // MARK: - Reflecting the phone's ongoing session

    func testReflectAdoptsWhenIdle() {
        let controller = LiveSessionController()
        XCTAssertFalse(controller.isActive)

        var session = ongoing(id: "-Phone1")
        session.addDrinks(2, of: .beer, atMillis: 1_700_000_000_000)
        XCTAssertTrue(controller.reflectOngoing(session))

        XCTAssertTrue(controller.isActive)
        XCTAssertEqual(controller.unitCount, 2, "adopted phone drinks count toward the total")
        XCTAssertEqual(controller.currentSession()?.id, "-Phone1")
    }

    func testReflectIgnoresNilAndNonOngoing() {
        let controller = LiveSessionController()
        XCTAssertFalse(controller.reflectOngoing(nil))

        var ended = ongoing(id: "-Ended")
        ended.ongoing = false
        XCTAssertFalse(controller.reflectOngoing(ended))
        XCTAssertFalse(controller.isActive)
    }

    func testReflectDoesNotClobberAnActiveSession() {
        let controller = LiveSessionController()
        controller.begin(adopting: nil, newId: "-Local", now: 1_000, timezone: "Europe/Prague")
        XCTAssertEqual(controller.currentSession()?.id, "-Local")

        // A phone snapshot arriving mid-session must not replace the local one.
        XCTAssertFalse(controller.reflectOngoing(ongoing(id: "-Phone9")))
        XCTAssertEqual(controller.currentSession()?.id, "-Local")
    }

    // MARK: - Begin (start), adopting the phone id when present

    func testBeginMintsFreshWhenNothingOngoing() {
        let controller = LiveSessionController()
        let started = controller.begin(adopting: nil, newId: "-Fresh", now: 5_000, timezone: "Europe/Prague")
        XCTAssertEqual(started.id, "-Fresh")
        XCTAssertTrue(started.ongoing)
        XCTAssertEqual(started.totalUnits, 0)
        XCTAssertTrue(controller.isActive)
    }

    func testBeginAdoptsOngoingPhoneId() {
        let controller = LiveSessionController()
        var phone = ongoing(id: "-PhoneAdopt")
        phone.addDrinks(1, of: .wine, atMillis: 1_700_000_000_000)
        let started = controller.begin(adopting: phone, newId: "-Unused", now: 6_000, timezone: "Europe/Prague")
        XCTAssertEqual(started.id, "-PhoneAdopt", "watch taps land in the phone's session, no duplicate")
        XCTAssertEqual(controller.unitCount, 1)
    }

    // MARK: - Watch-owned units

    func testAddAndSubtractOnFreshSession() {
        let controller = LiveSessionController()
        controller.begin(adopting: nil, newId: "-Count", now: 10_000, timezone: "Europe/Prague")

        XCTAssertTrue(controller.addUnit())
        XCTAssertTrue(controller.addUnit())
        XCTAssertTrue(controller.addUnit())
        XCTAssertEqual(controller.unitCount, 3)

        XCTAssertTrue(controller.subtractUnit())
        XCTAssertEqual(controller.unitCount, 2)
    }

    func testSubtractStopsAtZeroWithoutChange() {
        let controller = LiveSessionController()
        controller.begin(adopting: nil, newId: "-Zero", now: 11_000, timezone: "Europe/Prague")
        XCTAssertFalse(controller.subtractUnit(), "nothing to remove returns false (no haptic)")
        XCTAssertEqual(controller.unitCount, 0)
    }

    func testWatchSubtractNeverDeletesPhoneDrinks() {
        let controller = LiveSessionController()
        var phone = ongoing(id: "-Mixed")
        phone.addDrinks(2, of: .beer, atMillis: 1_700_000_000_000)
        controller.reflectOngoing(phone, now: 20_000)
        XCTAssertEqual(controller.unitCount, 2)

        // Watch adds one of its own, then tries to subtract three.
        XCTAssertTrue(controller.addUnit())
        XCTAssertEqual(controller.unitCount, 3)
        XCTAssertTrue(controller.subtractUnit())
        XCTAssertEqual(controller.unitCount, 2, "back to the phone's baseline")
        XCTAssertFalse(controller.subtractUnit(), "can't remove the phone's 2 beers")
        XCTAssertEqual(controller.unitCount, 2)
        // The phone's beers are intact in their original bucket.
        XCTAssertEqual(controller.currentSession()?.drinks?["1700000000000"]?["beer"], 2)
    }

    func testAddUnitNoOpWhenIdle() {
        let controller = LiveSessionController()
        XCTAssertFalse(controller.addUnit())
        XCTAssertFalse(controller.isActive)
    }

    // MARK: - Finalize + finish + no bounce

    func testMakeFinalizedMarksEndedWithoutClearing() {
        let controller = LiveSessionController()
        controller.begin(adopting: nil, newId: "-Fin", now: 30_000, timezone: "Europe/Prague")
        controller.addUnit()

        let finalized = controller.makeFinalized(now: 40_000)
        XCTAssertEqual(finalized?.ongoing, false)
        XCTAssertEqual(finalized?.endTime, 40_000)
        XCTAssertEqual(finalized?.totalUnits, 1)
        // State survives so a failed save can be retried.
        XCTAssertTrue(controller.isActive)
        XCTAssertEqual(controller.currentSession()?.ongoing, true)
    }

    func testMarkFinishedGoesIdle() {
        let controller = LiveSessionController()
        controller.begin(adopting: nil, newId: "-Done", now: 50_000, timezone: "Europe/Prague")
        controller.markFinished()
        XCTAssertFalse(controller.isActive)
        XCTAssertEqual(controller.unitCount, 0)
        XCTAssertNil(controller.currentSession())
    }

    func testFinishedSessionIsNotReAdopted() {
        let controller = LiveSessionController()
        let started = controller.begin(adopting: nil, newId: "-Save1", now: 60_000, timezone: "Europe/Prague")
        controller.markFinished()

        // A lagging phone snapshot of the just-finished session must not bounce
        // the UI back into it.
        var stale = started
        stale.ongoing = true
        XCTAssertFalse(controller.reflectOngoing(stale))
        XCTAssertFalse(controller.isActive)

        // But a genuinely new phone session is still adopted.
        XCTAssertTrue(controller.reflectOngoing(ongoing(id: "-New2")))
        XCTAssertTrue(controller.isActive)
    }

    func testBeginDoesNotAdoptAFinishedId() {
        let controller = LiveSessionController()
        let started = controller.begin(adopting: nil, newId: "-B1", now: 70_000, timezone: "Europe/Prague")
        controller.markFinished()

        // Starting again while a stale snapshot of the finished session lingers
        // mints a fresh id rather than resurrecting the finished one.
        var stale = started
        stale.ongoing = true
        let restarted = controller.begin(adopting: stale, newId: "-B2", now: 80_000, timezone: "Europe/Prague")
        XCTAssertEqual(restarted.id, "-B2")
    }

    // MARK: - Sessions v2 (schema 2) sessions

    private func ongoingV2(id: String, now: Int = 1_700_000_000_000) -> DrinkingSession {
        DrinkingSession.newLive(id: id, now: now, timezone: "Europe/Prague", schemaV2: true)
    }

    private func phoneEntry(ts: Int, key: DrinkKey, count: Int) -> SessionEntry {
        SessionEntry(
            ts: ts,
            key: key.rawValue,
            count: count,
            source: "phone",
            authorUid: "uid-phone",
            targetUid: "uid-phone",
            createdAt: ts
        )
    }

    func testBeginMintsASchema2SessionWhenAsked() {
        let controller = LiveSessionController()
        let started = controller.begin(adopting: nil, newId: "-V2", now: 5_000, timezone: "Europe/Prague", schemaV2: true)
        XCTAssertTrue(started.isSchemaV2)
        XCTAssertEqual(started.visibility, "friends")
        XCTAssertNil(started.drinks)
        XCTAssertEqual(started.totalUnits, 0)
    }

    func testAddUnitOnSchema2AppendsAWatchEntryForTheAuthor() {
        let controller = LiveSessionController()
        controller.begin(adopting: nil, newId: "-V2add", now: 5_000, timezone: "Europe/Prague", schemaV2: true)
        XCTAssertTrue(controller.addUnit(of: .beer, authorUid: "uid-me", now: 6_000, entryId: "-Entry1"))
        XCTAssertEqual(controller.unitCount, 1)
        let entry = controller.currentSession()?.entries?["-Entry1"]
        XCTAssertEqual(entry?.key, "beer")
        XCTAssertEqual(entry?.count, 1)
        XCTAssertEqual(entry?.source, "watch")
        XCTAssertEqual(entry?.authorUid, "uid-me")
        XCTAssertEqual(entry?.targetUid, "uid-me")
        XCTAssertEqual(entry?.ts, 6_000)
        XCTAssertEqual(entry?.createdAt, 6_000)
        XCTAssertNil(controller.currentSession()?.drinks, "a schema 2 session never grows buckets")
    }

    func testAddUnitOnSchema2NeedsAnAuthor() {
        let controller = LiveSessionController()
        controller.begin(adopting: nil, newId: "-V2noauthor", now: 5_000, timezone: "Europe/Prague", schemaV2: true)
        XCTAssertFalse(controller.addUnit(of: .beer, authorUid: nil))
        XCTAssertFalse(controller.addUnit(of: .beer, authorUid: ""))
        XCTAssertEqual(controller.unitCount, 0)
    }

    func testWatchSubtractOnSchema2TombstonesOnlyItsOwnEntries() {
        let controller = LiveSessionController()
        var phone = ongoingV2(id: "-V2mixed")
        phone.addEntry(phoneEntry(ts: 1_700_000_000_000, key: .beer, count: 2), id: "phone-1")
        controller.reflectOngoing(phone, now: 20_000)
        XCTAssertEqual(controller.unitCount, 2)

        XCTAssertTrue(controller.addUnit(of: .beer, authorUid: "uid-me", now: 21_000, entryId: "watch-1"))
        XCTAssertEqual(controller.unitCount, 3)
        XCTAssertTrue(controller.subtractUnit(of: .beer, now: 22_000))
        XCTAssertEqual(controller.unitCount, 2, "back to the phone's baseline")
        // The watch's entry is a tombstone, its key kept; the phone's is intact.
        XCTAssertEqual(controller.currentSession()?.entries?["watch-1"]?.deleted, true)
        XCTAssertEqual(controller.currentSession()?.entries?["watch-1"]?.editedAt, 22_000)
        XCTAssertEqual(controller.currentSession()?.entries?["phone-1"]?.count, 2)
        XCTAssertNil(controller.currentSession()?.entries?["phone-1"]?.deleted)
        XCTAssertFalse(controller.subtractUnit(of: .beer), "can't remove the phone's beers")
        XCTAssertEqual(controller.unitCount, 2)
    }

    func testWatchSubtractOnSchema2RemovesTheNewestOfItsOwnFirst() {
        let controller = LiveSessionController()
        controller.begin(adopting: nil, newId: "-V2order", now: 5_000, timezone: "Europe/Prague", schemaV2: true)
        controller.addUnit(of: .beer, authorUid: "uid-me", now: 6_000, entryId: "w1")
        controller.addUnit(of: .wine, authorUid: "uid-me", now: 7_000, entryId: "w2")
        controller.addUnit(of: .beer, authorUid: "uid-me", now: 8_000, entryId: "w3")
        XCTAssertTrue(controller.subtractUnit(of: .beer, now: 9_000))
        XCTAssertEqual(controller.currentSession()?.entries?["w3"]?.deleted, true)
        XCTAssertNil(controller.currentSession()?.entries?["w1"]?.deleted)
        XCTAssertFalse(controller.subtractUnit(of: .cocktail), "nothing of that type to remove")
        XCTAssertEqual(controller.unitCount, 2)
    }

    func testMarkFinishedForgetsTheWatchEntries() {
        let controller = LiveSessionController()
        controller.begin(adopting: nil, newId: "-V2done", now: 5_000, timezone: "Europe/Prague", schemaV2: true)
        controller.addUnit(of: .beer, authorUid: "uid-me", entryId: "w1")
        controller.markFinished()
        // A new session adopted later must not be able to tombstone "w1".
        var next = ongoingV2(id: "-V2next")
        next.addEntry(SessionEntry(ts: 1, key: "beer", count: 1, source: "watch", authorUid: "uid-me", targetUid: "uid-me", createdAt: 1), id: "w1")
        controller.reflectOngoing(next)
        XCTAssertFalse(controller.subtractUnit(of: .beer))
        XCTAssertEqual(controller.unitCount, 1)
    }
}
