import XCTest
@testable import KirokuWatchCore

final class DrinkingSessionTests: XCTestCase {
    private func encodeToObject(_ session: DrinkingSession) throws -> [String: Any] {
        let data = try JSONEncoder().encode(session)
        let object = try JSONSerialization.jsonObject(with: data)
        return try XCTUnwrap(object as? [String: Any])
    }

    func testEncodesWireKeysMatchingTheSpike() throws {
        let now = 1_700_000_000_000
        var session = DrinkingSession.newLive(id: "abc123", now: now, timezone: "Europe/Prague")
        session.addDrinks(2, of: .beer, atMillis: now)

        let object = try encodeToObject(session)

        // Field set + snake_case mapping mirrors getEmptySession + the spike body.
        XCTAssertEqual(object["id"] as? String, "abc123")
        XCTAssertEqual(object["start_time"] as? Int, now)
        XCTAssertEqual(object["end_time"] as? Int, now)
        XCTAssertEqual(object["blackout"] as? Bool, false)
        XCTAssertEqual(object["note"] as? String, "")
        XCTAssertEqual(object["timezone"] as? String, "Europe/Prague")
        XCTAssertEqual(object["type"] as? String, "live")
        XCTAssertEqual(object["ongoing"] as? Bool, true)

        // No camelCase leakage of the timestamp fields.
        XCTAssertNil(object["startTime"])
        XCTAssertNil(object["endTime"])

        let drinks = try XCTUnwrap(object["drinks"] as? [String: Any])
        let bucket = try XCTUnwrap(drinks[String(now)] as? [String: Any])
        XCTAssertEqual(bucket["beer"] as? Int, 2)
    }

    func testDrinksOmittedWhenNoUnitsLogged() throws {
        let session = DrinkingSession.newLive(id: "no-drinks", now: 1_700_000_000_000, timezone: "Europe/Prague")
        let object = try encodeToObject(session)
        // The spike omits the `drinks` key entirely when zero units are logged.
        XCTAssertNil(object["drinks"], "drinks key must be absent for an empty session")
        XCTAssertEqual(session.totalUnits, 0)
    }

    func testAllDrinkKeysSerializeToWireStrings() {
        XCTAssertEqual(DrinkKey.smallBeer.rawValue, "small_beer")
        XCTAssertEqual(DrinkKey.beer.rawValue, "beer")
        XCTAssertEqual(DrinkKey.cocktail.rawValue, "cocktail")
        XCTAssertEqual(DrinkKey.wine.rawValue, "wine")
        XCTAssertEqual(DrinkKey.strongShot.rawValue, "strong_shot")
        XCTAssertEqual(DrinkKey.weakShot.rawValue, "weak_shot")
        XCTAssertEqual(DrinkKey.other.rawValue, "other")
        XCTAssertEqual(Set(DrinkKey.allCases.map(\.rawValue)).count, 7)
    }

    func testAddAndRemoveDrinksCollapsesEmptyBuckets() {
        let now = 1_700_000_000_000
        var session = DrinkingSession.newLive(id: "x", now: now, timezone: "Europe/Prague")
        session.addDrinks(3, of: .beer, atMillis: now)
        XCTAssertEqual(session.totalUnits, 3)
        session.addDrinks(-1, of: .beer, atMillis: now)
        XCTAssertEqual(session.totalUnits, 2)
        XCTAssertEqual(session.drinks?[String(now)]?["beer"], 2)
        // Removing the rest collapses the bucket and the whole drinks map back to nil.
        session.addDrinks(-2, of: .beer, atMillis: now)
        XCTAssertEqual(session.totalUnits, 0)
        XCTAssertNil(session.drinks)
    }

    func testMixedDrinkTypesAndTimestamps() {
        var session = DrinkingSession.newLive(id: "x", now: 0, timezone: "Europe/Prague")
        session.addDrinks(1, of: .beer, atMillis: 1000)
        session.addDrinks(2, of: .wine, atMillis: 1000)
        session.addDrinks(1, of: .cocktail, atMillis: 2000)
        XCTAssertEqual(session.totalUnits, 4)
        XCTAssertEqual(session.drinks?["1000"]?["beer"], 1)
        XCTAssertEqual(session.drinks?["1000"]?["wine"], 2)
        XCTAssertEqual(session.drinks?["2000"]?["cocktail"], 1)
    }

    func testCodableRoundTrip() throws {
        let now = 1_700_000_000_123
        var original = DrinkingSession.newLive(id: "round-trip", now: now, timezone: "America/New_York")
        original.addDrinks(2, of: .strongShot, atMillis: now)
        original.note = "a note"
        original.blackout = true

        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(DrinkingSession.self, from: data)
        XCTAssertEqual(decoded, original)
    }

    // MARK: - Sessions v2 (schema 2)

    private func v2Entry(ts: Int, key: DrinkKey, count: Int, deleted: Bool? = nil) -> SessionEntry {
        SessionEntry(
            ts: ts,
            key: key.rawValue,
            count: count,
            source: "phone",
            authorUid: "uid-1",
            targetUid: "uid-1",
            createdAt: ts,
            deleted: deleted
        )
    }

    func testDecodesASchema2SessionWithEntries() throws {
        let json = """
        {"id":"-V2","start_time":1700000000000,"end_time":1700000005000,"blackout":false,\
        "note":"","timezone":"Europe/Prague","type":"live","ongoing":true,\
        "schema_version":2,"name":"Friday evening","visibility":"friends",\
        "entries":{"a":{"ts":1700000001000,"key":"beer","count":2,"source":"phone",\
        "author_uid":"uid-1","target_uid":"uid-1","created_at":1700000001000},\
        "b":{"ts":1700000002000,"key":"wine","count":1,"volume_ml":150,"abv":0.12,\
        "source":"web","author_uid":"uid-1","target_uid":"uid-1","created_at":1700000002000,\
        "deleted":true,"edited_at":1700000003000}},"someUnknownKey":1}
        """
        let session = try JSONDecoder().decode(DrinkingSession.self, from: Data(json.utf8))
        XCTAssertTrue(session.isSchemaV2)
        XCTAssertEqual(session.name, "Friday evening")
        XCTAssertEqual(session.visibility, "friends")
        XCTAssertNil(session.drinks)
        XCTAssertEqual(session.entries?.count, 2)
        XCTAssertEqual(session.entries?["b"]?.volumeMl, 150)
        XCTAssertEqual(session.entries?["b"]?.abv, 0.12)
        XCTAssertEqual(session.entries?["b"]?.deleted, true)
        // The tombstone does not count.
        XCTAssertEqual(session.totalUnits, 2)
        XCTAssertEqual(session.liveEntries().map(\.id), ["a"])
    }

    func testSchema2RoundTripKeepsEntriesAndOmitsDrinks() throws {
        var session = DrinkingSession.newLive(id: "-RT", now: 1_700_000_000_000, timezone: "Europe/Prague", schemaV2: true)
        session.addEntry(v2Entry(ts: 1_700_000_001_000, key: .beer, count: 1), id: "e1")
        let data = try JSONEncoder().encode(session)
        let object = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(object["schema_version"] as? Int, 2)
        XCTAssertEqual(object["visibility"] as? String, "friends")
        XCTAssertNil(object["drinks"], "a schema 2 session never carries buckets")
        XCTAssertNil(object["name"], "the watch leaves the name for the phone")
        let entries = try XCTUnwrap(object["entries"] as? [String: Any])
        let e1 = try XCTUnwrap(entries["e1"] as? [String: Any])
        XCTAssertEqual(e1["author_uid"] as? String, "uid-1")
        XCTAssertEqual(e1["created_at"] as? Int, 1_700_000_001_000)
        XCTAssertNil(e1["deleted"], "absent flags stay absent on the wire")
        XCTAssertEqual(try JSONDecoder().decode(DrinkingSession.self, from: data), session)
    }

    func testLegacySessionKeepsItsShapeOnTheWire() throws {
        var session = DrinkingSession.newLive(id: "-Legacy", now: 1_700_000_000_000, timezone: "Europe/Prague")
        session.addDrinks(1, of: .beer, atMillis: 1_700_000_000_000)
        let object = try encodeToObject(session)
        XCTAssertNil(object["schema_version"])
        XCTAssertNil(object["entries"])
        XCTAssertNil(object["visibility"])
        XCTAssertNotNil(object["drinks"])
    }

    func testLegacyAndSchema2TwinsCountTheSame() {
        let now = 1_700_000_000_000
        var legacy = DrinkingSession.newLive(id: "-L", now: now, timezone: "Europe/Prague")
        legacy.addDrinks(2, of: .beer, atMillis: now)
        legacy.addDrinks(1, of: .wine, atMillis: now + 1_000)
        legacy.addDrinks(3, of: .strongShot, atMillis: now + 2_000)

        var twin = DrinkingSession.newLive(id: "-T", now: now, timezone: "Europe/Prague", schemaV2: true)
        for (id, entry) in legacy.liveEntries(ownerUid: "uid-1") {
            twin.addEntry(entry, id: id)
        }
        XCTAssertEqual(twin.totalUnits, legacy.totalUnits)
        XCTAssertEqual(legacy.totalUnits, 6)
        XCTAssertEqual(twin.liveEntries().map(\.id), legacy.liveEntries().map(\.id))
    }

    func testLegacyEntriesUseTheSharedDeterministicIds() {
        var legacy = DrinkingSession.newLive(id: "-Ids", now: 1_700_000_000_000, timezone: "Europe/Prague")
        legacy.addDrinks(2, of: .beer, atMillis: 1_700_000_000_000)
        legacy.addDrinks(1, of: .wine, atMillis: 1_700_000_000_000)
        legacy.addDrinks(1, of: .cocktail, atMillis: 1_700_000_600_000)
        let entries = legacy.liveEntries(ownerUid: "owner-uid-1")
        XCTAssertEqual(
            entries.map(\.id),
            ["legacy-1700000000000-beer", "legacy-1700000000000-wine", "legacy-1700000600000-cocktail"]
        )
        XCTAssertEqual(entries[0].entry.source, "phone")
        XCTAssertEqual(entries[0].entry.authorUid, "owner-uid-1")
        XCTAssertEqual(entries[0].entry.targetUid, "owner-uid-1")
        XCTAssertEqual(entries[0].entry.createdAt, 1_700_000_000_000)
    }

    func testTombstoneAndReduceKeepKeys() {
        var session = DrinkingSession.newLive(id: "-Tomb", now: 0, timezone: "Europe/Prague", schemaV2: true)
        session.addEntry(v2Entry(ts: 1_000, key: .beer, count: 3), id: "e1")
        session.reduceEntry(id: "e1", by: 1, atMillis: 2_000)
        XCTAssertEqual(session.entries?["e1"]?.count, 2)
        XCTAssertEqual(session.entries?["e1"]?.editedAt, 2_000)
        // Never below one drink: a reduce that would empty it is a no-op.
        session.reduceEntry(id: "e1", by: 2, atMillis: 3_000)
        XCTAssertEqual(session.entries?["e1"]?.count, 2)
        session.tombstoneEntry(id: "e1", atMillis: 4_000)
        XCTAssertEqual(session.entries?["e1"]?.deleted, true)
        XCTAssertEqual(session.entries?.count, 1, "keys are never removed")
        XCTAssertEqual(session.totalUnits, 0)
    }
}
