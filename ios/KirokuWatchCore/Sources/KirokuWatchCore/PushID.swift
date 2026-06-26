import Foundation
import Security

/// A faithful Swift port of `generatePushID()` (`src/libs/generatePushID.ts`),
/// itself Michael Lehenbauer's canonical Firebase push-id algorithm. Produces
/// 20-character, lexicographically-sortable keys that are format-compatible with
/// the ids every existing drinking session already uses, so a watch-minted id is
/// indistinguishable from a phone-minted one.
///
/// Layout (20 chars over the 64-char, sort-order-preserving alphabet):
///   - chars 0–7:  the millisecond timestamp, big-endian → keys sort by time.
///   - chars 8–19: 72 bits of secure randomness → collision resistance.
///
/// Two ids minted in the same millisecond stay strictly ordered: the previous
/// 72-bit random suffix is incremented by one (with carry) instead of re-rolled.
///
/// The shared ``generate()`` is serialized with a lock so concurrent taps from
/// different threads cannot corrupt the same-millisecond carry state.
public final class PushID: @unchecked Sendable {
    /// Process-wide generator. Mirrors the module-level state of the JS version.
    public static let shared = PushID()

    /// Modeled after the Firebase JS SDK. The ordering of this alphabet is
    /// load-bearing: ASCII `-` < digits < uppercase < `_` < lowercase, so
    /// lexicographic string order equals chronological order.
    public static let pushChars = Array("-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz")

    private let lock = NSLock()

    /// Timestamp (ms) of the last push, to detect same-millisecond collisions.
    private var lastPushTime = 0

    /// The 12 random "digits" (each 0–63) from the previous call. On a same-ms
    /// collision they are incremented (not re-randomized) to preserve ordering.
    private var lastRandChars = [Int](repeating: 0, count: 12)

    public init() {}

    /// Generate a new 20-character push id using the current wall-clock time.
    public static func generate() -> String {
        shared.generate()
    }

    /// Generate a new 20-character push id using the current wall-clock time.
    public func generate() -> String {
        generate(atMillis: DrinkingSession.nowMillis())
    }

    /// Generate a push id for an explicit epoch-millisecond timestamp.
    ///
    /// Exposed for deterministic tests (the JS reference reads `Date.now()`);
    /// production callers use the argument-less ``generate()``.
    public func generate(atMillis now: Int) -> String {
        lock.lock()
        defer { lock.unlock() }

        let duplicateTime = now == lastPushTime
        lastPushTime = now

        // chars 0–7: big-endian base-64 of the timestamp.
        var remaining = now
        var timeStampChars = [Character](repeating: "-", count: 8)
        var i = 7
        while i >= 0 {
            timeStampChars[i] = PushID.pushChars[remaining % 64]
            remaining /= 64
            i -= 1
        }
        precondition(remaining == 0, "PushID: timestamp did not fully convert")

        if !duplicateTime {
            rerollRandChars()
        } else {
            // Same millisecond as the previous id: increment the 72-bit random
            // suffix by one (with carry) so the new id still sorts strictly after.
            var j = 11
            while j >= 0 && lastRandChars[j] == 63 {
                lastRandChars[j] = 0
                j -= 1
            }
            if j >= 0 {
                lastRandChars[j] += 1
            } else {
                // Astronomically unlikely (>2^72 ids in one ms): every digit rolled
                // over. Reroll rather than emit a wrapped, non-monotonic suffix.
                rerollRandChars()
            }
        }

        var id = String(timeStampChars)
        for k in 0..<12 {
            id.append(PushID.pushChars[lastRandChars[k]])
        }

        precondition(id.count == 20, "PushID: generated id length is not 20")
        return id
    }

    /// Refill `lastRandChars` with 12 fresh 6-bit values (0–63) from 72 bits of
    /// secure randomness. The 9 random bytes are read as one big-endian 72-bit
    /// stream and sliced into 12 six-bit chunks (9 × 8 == 12 × 6) — the exact bit
    /// math of the JS reference.
    private func rerollRandChars() {
        var bytes = [UInt8](repeating: 0, count: 9)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        if status != errSecSuccess {
            // SecRandomCopyBytes effectively never fails on-device; fall back to a
            // non-crypto source rather than aborting an in-flight session write.
            for index in bytes.indices {
                bytes[index] = UInt8.random(in: UInt8.min...UInt8.max)
            }
        }

        for i in 0..<12 {
            let bitPos = i * 6
            let bytePos = bitPos >> 3
            let bitOffset = bitPos & 7
            let hi = Int(bytes[bytePos])
            let lo = bytePos + 1 < bytes.count ? Int(bytes[bytePos + 1]) : 0
            let bits = (hi << 8) | lo
            lastRandChars[i] = (bits >> (10 - bitOffset)) & 0x3f
        }
    }

    #if DEBUG
    /// Test-only: seed the 12-digit random-suffix carry state so the
    /// same-millisecond carry path can be exercised deterministically.
    func setLastRandCharsForTesting(_ chars: [Int]) {
        precondition(chars.count == 12, "expected 12 digits")
        lock.lock()
        defer { lock.unlock() }
        lastRandChars = chars
    }
    #endif
}
