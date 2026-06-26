import Foundation

/// A drink-type identifier, mirroring `CONST.DRINKS.KEYS`
/// (`src/CONST.ts`) and the `DrinkKey` union in `src/types/onyx/Drinks.ts`.
///
/// The raw values are the exact wire strings the API expects as keys inside a
/// session's `drinks` buckets.
public enum DrinkKey: String, Codable, CaseIterable, Sendable {
    case smallBeer = "small_beer"
    case beer
    case cocktail
    case wine
    case strongShot = "strong_shot"
    case weakShot = "weak_shot"
    case other
}

/// The kind of a session, mirroring `CONST.SESSION.TYPES`
/// (`SESSION_TYPES` in `src/CONST.ts`). The watch only ever creates `.live`
/// sessions; `.edit` exists so a session decoded from the phone (Phase 3) never
/// fails to parse.
public enum SessionType: String, Codable, CaseIterable, Sendable {
    case live
    case edit
}

/// A single timestamp bucket of drinks: `drinkKey -> count`.
///
/// The keys are `DrinkKey` raw strings. Modelled as `[String: Int]` (not
/// `[DrinkKey: Int]`) so the JSON encodes as a plain object with string keys —
/// `{"beer": 2}` — exactly like the source contract and the Phase 0 spike. The
/// numeric form is the only one the watch writes; the app's richer per-event
/// `{count, volume_ml, abv}` arm (`DrinkEntry` in `src/types/onyx/Drinks.ts`) is
/// out of scope for the MVP.
public typealias DrinkBucket = [String: Int]

/// A collection of timestamped drink buckets, keyed by an epoch-millisecond
/// timestamp rendered as a string — mirroring `DrinksList`
/// (`Record<Timestamp, Record<DrinkKey, number>>`) in
/// `src/types/onyx/Drinks.ts`.
public typealias DrinksList = [String: DrinkBucket]

/// A Codable mirror of `DrinkingSession` (`src/types/onyx/DrinkingSession.ts`)
/// as produced by `getEmptySession(...)` and posted by the Phase 0 spike
/// (`scripts/watch-spike/post-session.mjs`).
///
/// Field names map to the snake_case wire format (`start_time`, `end_time`) via
/// `CodingKeys`; everything else is already wire-identical. `drinks` is encoded
/// only when present, matching the spike (which omits the key when no units have
/// been logged).
public struct DrinkingSession: Codable, Equatable, Sendable {
    /// A unique session identifier — a Firebase push id (see ``PushID``).
    public var id: String

    /// Epoch-millisecond start time.
    public var startTime: Int

    /// Epoch-millisecond end time. For a live session this tracks "now".
    public var endTime: Int

    /// Whether the user reported a blackout.
    public var blackout: Bool

    /// A private free-text note.
    public var note: String

    /// IANA timezone identifier the session took place in (e.g. `Europe/Prague`).
    public var timezone: String

    /// The session kind. Always `.live` for watch-originated sessions.
    public var type: SessionType

    /// Whether the session is still going on. `true` while live; set `false`
    /// when saving to end it.
    public var ongoing: Bool

    /// Timestamped drink buckets. `nil`/omitted when nothing has been logged.
    public var drinks: DrinksList?

    private enum CodingKeys: String, CodingKey {
        case id
        case startTime = "start_time"
        case endTime = "end_time"
        case blackout
        case note
        case timezone
        case type
        case ongoing
        case drinks
    }

    public init(
        id: String,
        startTime: Int,
        endTime: Int,
        blackout: Bool = false,
        note: String = "",
        timezone: String,
        type: SessionType = .live,
        ongoing: Bool = true,
        drinks: DrinksList? = nil
    ) {
        self.id = id
        self.startTime = startTime
        self.endTime = endTime
        self.blackout = blackout
        self.note = note
        self.timezone = timezone
        self.type = type
        self.ongoing = ongoing
        self.drinks = drinks
    }
}

public extension DrinkingSession {
    /// Build a fresh live session, mirroring `getEmptySession('live', ...)` plus
    /// the spike's `buildSession`: `start_time == end_time == now`, `ongoing`,
    /// no drinks yet.
    ///
    /// - Parameters:
    ///   - id: the session id (typically `PushID.generate()`).
    ///   - now: epoch-millisecond timestamp for start/end (defaults to now).
    ///   - timezone: IANA identifier (defaults to the device's current zone).
    static func newLive(
        id: String,
        now: Int = DrinkingSession.nowMillis(),
        timezone: String = TimeZone.current.identifier
    ) -> DrinkingSession {
        DrinkingSession(
            id: id,
            startTime: now,
            endTime: now,
            blackout: false,
            note: "",
            timezone: timezone,
            type: .live,
            ongoing: true,
            drinks: nil
        )
    }

    /// Current epoch time in milliseconds — the unit `start_time`/`end_time` and
    /// the `drinks` timestamp keys use throughout the contract.
    static func nowMillis() -> Int {
        Int((Date().timeIntervalSince1970 * 1000).rounded())
    }

    /// Add (or subtract, with a negative `count`) `count` drinks of `key` into the
    /// bucket at `atMillis`. A bucket or key that drops to zero is removed so the
    /// encoded session stays minimal; the whole `drinks` map collapses back to
    /// `nil` when empty. The watch sends the whole session on every change, so
    /// callers mutate the session and re-`update` it.
    mutating func addDrinks(_ count: Int, of key: DrinkKey, atMillis: Int = DrinkingSession.nowMillis()) {
        guard count != 0 else { return }
        let bucketKey = String(atMillis)
        var list = drinks ?? [:]
        var bucket = list[bucketKey] ?? [:]
        let next = (bucket[key.rawValue] ?? 0) + count
        if next > 0 {
            bucket[key.rawValue] = next
        } else {
            bucket[key.rawValue] = nil
        }
        if bucket.isEmpty {
            list[bucketKey] = nil
        } else {
            list[bucketKey] = bucket
        }
        drinks = list.isEmpty ? nil : list
    }

    /// Total number of drinks logged across all buckets and types.
    var totalUnits: Int {
        (drinks ?? [:]).values.reduce(0) { $0 + $1.values.reduce(0, +) }
    }
}
