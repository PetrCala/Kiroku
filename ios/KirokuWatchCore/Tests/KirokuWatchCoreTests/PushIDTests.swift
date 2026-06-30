import XCTest
@testable import KirokuWatchCore

final class PushIDTests: XCTestCase {
    private let pushChars = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz"

    func testAlphabetMatchesReference() {
        // The alphabet is load-bearing (sort order). Lock it to the JS reference.
        XCTAssertEqual(String(PushID.pushChars), pushChars)
        XCTAssertEqual(PushID.pushChars.count, 64)
    }

    func testIdIsTwentyCharsOverTheAlphabet() {
        let allowed = Set(pushChars)
        for _ in 0..<200 {
            let id = PushID().generate()
            XCTAssertEqual(id.count, 20, "id must be 20 chars: \(id)")
            XCTAssertTrue(id.allSatisfy { allowed.contains($0) }, "id has out-of-alphabet char: \(id)")
        }
    }

    func testTimestampPrefixEncoding() {
        // now == 0 → all eight timestamp chars are the alphabet's first char.
        let zero = PushID().generate(atMillis: 0)
        XCTAssertEqual(String(zero.prefix(8)), "--------")

        // now == 63 → low digit is the alphabet's last char, rest are the first.
        let sixtyThree = PushID().generate(atMillis: 63)
        XCTAssertEqual(String(sixtyThree.prefix(8)), "-------z")

        // now == 64 → carries into the next digit: pushChars[1] ('0') then pushChars[0] ('-').
        let sixtyFour = PushID().generate(atMillis: 64)
        XCTAssertEqual(String(sixtyFour.prefix(8)), "------0-")
    }

    func testTimestampPrefixRoundTripsForRealisticMillis() {
        let millis = 1_700_000_000_000 // 2023-11-14T22:13:20Z
        let id = PushID().generate(atMillis: millis)
        XCTAssertEqual(decodeTimestamp(String(id.prefix(8))), millis)
    }

    func testSameMillisecondIdsAreStrictlyIncreasing() {
        let gen = PushID()
        var ids: [String] = []
        for _ in 0..<50 {
            ids.append(gen.generate(atMillis: 1_700_000_000_000))
        }
        // All share the same timestamp prefix...
        let prefixes = Set(ids.map { String($0.prefix(8)) })
        XCTAssertEqual(prefixes.count, 1, "same-ms ids must share a timestamp prefix")
        // ...and the full ids sort strictly ascending (random suffix incremented).
        XCTAssertEqual(ids, ids.sorted(), "same-ms ids must be monotonically increasing")
        XCTAssertEqual(Set(ids).count, ids.count, "same-ms ids must be unique")
    }

    func testLaterMillisSortsAfterEarlier() {
        let gen = PushID()
        let earlier = gen.generate(atMillis: 1_700_000_000_000)
        let later = gen.generate(atMillis: 1_700_000_000_001)
        XCTAssertLessThan(earlier, later, "a later-ms id must sort after an earlier one")
    }

    func testSameMillisCarryAcrossDigits() {
        let gen = PushID()
        let ms = 1_700_000_000_000
        // First call at `ms` is not a duplicate (lastPushTime starts at 0); it
        // rerolls and records `ms` as the last push time.
        _ = gen.generate(atMillis: ms)
        // Seed a suffix whose trailing digit is maxed so the next same-ms call
        // carries: index 11 (63) resets to 0 and index 10 (5) increments to 6.
        gen.setLastRandCharsForTesting([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 63])
        let a = gen.generate(atMillis: ms)
        // index 11 (0) simply increments to 1 — no carry.
        let b = gen.generate(atMillis: ms)
        XCTAssertEqual(String(a.prefix(8)), String(b.prefix(8)), "carry must not touch the timestamp prefix")
        XCTAssertLessThan(a, b, "carried suffix must still sort ascending")
        XCTAssertNotEqual(a, b)
    }

    func testThreadSafetyProducesUniqueIds() {
        let gen = PushID()
        let count = 2_000
        let lock = NSLock()
        var ids = Set<String>()
        DispatchQueue.concurrentPerform(iterations: count) { _ in
            let id = gen.generate()
            lock.lock()
            ids.insert(id)
            lock.unlock()
        }
        XCTAssertEqual(ids.count, count, "concurrent generation must not collide or corrupt state")
    }

    // MARK: - Helpers

    /// Reverse the big-endian base-64 timestamp encoding back into millis.
    private func decodeTimestamp(_ prefix: String) -> Int {
        var value = 0
        for char in prefix {
            guard let index = pushChars.firstIndex(of: char) else {
                XCTFail("char \(char) not in alphabet")
                return -1
            }
            value = value * 64 + pushChars.distance(from: pushChars.startIndex, to: index)
        }
        return value
    }
}
