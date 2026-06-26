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
}
