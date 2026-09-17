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

/// One drink event in a Sessions v2 session, mirroring `SessionEntry` in
/// `src/types/onyx/SessionEntries.ts` (RFC §4.3). Keys of the `entries` map are
/// never removed: a deleted entry stays as a tombstone (`deleted == true`).
public struct SessionEntry: Codable, Equatable, Sendable {
    /// When the drink happened (epoch ms).
    public var ts: Int
    /// The drink type (a `DrinkKey` raw value; kept as a string so an unknown
    /// type the phone may add later never fails the whole decode).
    public var key: String
    /// How many drinks of `key` this entry stands for.
    public var count: Int
    public var volumeMl: Double?
    public var abv: Double?
    /// Where the entry was logged from: `phone`, `watch`, `live_activity`, `web`.
    public var source: String
    public var authorUid: String
    public var targetUid: String
    public var roundId: String?
    public var createdAt: Int
    public var editedAt: Int?
    public var deleted: Bool?
    public var late: Bool?
    public var declined: Bool?

    private enum CodingKeys: String, CodingKey {
        case ts
        case key
        case count
        case volumeMl = "volume_ml"
        case abv
        case source
        case authorUid = "author_uid"
        case targetUid = "target_uid"
        case roundId = "round_id"
        case createdAt = "created_at"
        case editedAt = "edited_at"
        case deleted
        case late
        case declined
    }

    public init(
        ts: Int,
        key: String,
        count: Int,
        volumeMl: Double? = nil,
        abv: Double? = nil,
        source: String,
        authorUid: String,
        targetUid: String,
        roundId: String? = nil,
        createdAt: Int,
        editedAt: Int? = nil,
        deleted: Bool? = nil,
        late: Bool? = nil,
        declined: Bool? = nil
    ) {
        self.ts = ts
        self.key = key
        self.count = count
        self.volumeMl = volumeMl
        self.abv = abv
        self.source = source
        self.authorUid = authorUid
        self.targetUid = targetUid
        self.roundId = roundId
        self.createdAt = createdAt
        self.editedAt = editedAt
        self.deleted = deleted
        self.late = late
        self.declined = declined
    }

    /// Whether the entry still counts: not a tombstone, with a positive count.
    public var isLive: Bool {
        deleted != true && count > 0
    }

    /// The `source` value of an entry the watch logs.
    public static let watchSource = "watch"
}

/// The `entries` map of a Sessions v2 session, keyed by entry id.
public typealias SessionEntries = [String: SessionEntry]

/// A Codable mirror of `DrinkingSession` (`src/types/onyx/DrinkingSession.ts`)
/// as produced by `getEmptySession(...)` and posted by the Phase 0 spike
/// (`scripts/watch-spike/post-session.mjs`).
///
/// Field names map to the snake_case wire format (`start_time`, `end_time`) via
/// `CodingKeys`; everything else is already wire-identical. `drinks` is encoded
/// only when present, matching the spike (which omits the key when no units have
/// been logged).
///
/// Two shapes decode (Sessions v2 RFC §4 and §11): a **legacy** session keeps
/// its drinks in `drinks[timestamp][drinkKey]` buckets; a **schema 2** session
/// (`schema_version == 2`) keeps them in `entries`. Read drinks through
/// ``liveEntries(ownerUid:)`` or ``totalUnits``, never from the fields
/// directly, so both shapes count the same way the phone app counts them.
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

    /// Timestamped drink buckets (legacy shape). `nil`/omitted when nothing
    /// has been logged, and always `nil` on a schema 2 session.
    public var drinks: DrinksList?

    /// `2` on a Sessions v2 session; absent on a legacy one.
    public var schemaVersion: Int?

    /// The session's name (schema 2 only).
    public var name: String?

    /// `friends` or `private` (schema 2 only).
    public var visibility: String?

    /// The drinks of a schema 2 session, tombstones included. `nil` when
    /// nothing has been logged yet (RTDB drops an empty map).
    public var entries: SessionEntries?

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
        case schemaVersion = "schema_version"
        case name
        case visibility
        case entries
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
        drinks: DrinksList? = nil,
        schemaVersion: Int? = nil,
        name: String? = nil,
        visibility: String? = nil,
        entries: SessionEntries? = nil
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
        self.schemaVersion = schemaVersion
        self.name = name
        self.visibility = visibility
        self.entries = entries
    }

    /// The `schema_version` of a Sessions v2 session.
    public static let schemaVersionV2 = 2

    /// The `visibility` a new session starts with (RFC §4.2).
    public static let defaultVisibility = "friends"

    /// Whether this is a Sessions v2 session (drinks in `entries`).
    public var isSchemaV2: Bool {
        schemaVersion == DrinkingSession.schemaVersionV2
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
    ///   - schemaV2: mint a Sessions v2 session (`schema_version: 2`,
    ///     `visibility: friends`, drinks as entries) instead of a legacy one.
    ///     The phone tells the watch which shape to use (`sessionsV2Schema` in
    ///     the credential push, from the `SESSIONS_V2_SCHEMA` flag). The name
    ///     is left for the phone to fill in; the API accepts a session without
    ///     one.
    static func newLive(
        id: String,
        now: Int = DrinkingSession.nowMillis(),
        timezone: String = TimeZone.current.identifier,
        schemaV2: Bool = false
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
            drinks: nil,
            schemaVersion: schemaV2 ? DrinkingSession.schemaVersionV2 : nil,
            visibility: schemaV2 ? DrinkingSession.defaultVisibility : nil
        )
    }

    /// Prefix of the entry id a legacy bucket key converts into; the same
    /// derivation as the phone app's `legacyEntryId` and the backfill.
    static let legacyEntryIDPrefix = "legacy"

    /// The deterministic id of the entry a legacy bucket key converts into.
    static func legacyEntryID(ts: Int, key: String) -> String {
        "\(legacyEntryIDPrefix)-\(ts)-\(key)"
    }

    /// The read adapter (RFC §11), as the phone app's `getSessionEntries`: the
    /// drinks of either shape as live entries, sorted by time then id. A schema
    /// 2 session yields its `entries` minus tombstones; a legacy session yields
    /// one entry per bucket key with a positive count, `source: phone`,
    /// authored by and targeting `ownerUid`, under the deterministic legacy id.
    func liveEntries(ownerUid: String = "") -> [(id: String, entry: SessionEntry)] {
        var result: [(id: String, entry: SessionEntry)] = []
        if isSchemaV2 {
            for (id, entry) in entries ?? [:] where entry.isLive {
                result.append((id, entry))
            }
        } else {
            for (bucketKey, bucket) in drinks ?? [:] {
                guard let ts = Int(bucketKey) else { continue }
                for (key, count) in bucket where count > 0 {
                    let entry = SessionEntry(
                        ts: ts,
                        key: key,
                        count: count,
                        source: "phone",
                        authorUid: ownerUid,
                        targetUid: ownerUid,
                        createdAt: ts
                    )
                    result.append((DrinkingSession.legacyEntryID(ts: ts, key: key), entry))
                }
            }
        }
        return result.sorted { a, b in
            if a.entry.ts != b.entry.ts {
                return a.entry.ts < b.entry.ts
            }
            return a.id < b.id
        }
    }

    /// Append one entry under `id` to a schema 2 session.
    mutating func addEntry(_ entry: SessionEntry, id: String) {
        var map = entries ?? [:]
        map[id] = entry
        entries = map
    }

    /// Turn the entry under `id` into a tombstone. Its key stays in the map.
    mutating func tombstoneEntry(id: String, atMillis: Int) {
        guard var entry = entries?[id] else { return }
        entry.deleted = true
        entry.editedAt = atMillis
        entries?[id] = entry
    }

    /// Take `by` drinks off the entry under `id`, leaving at least one.
    mutating func reduceEntry(id: String, by amount: Int, atMillis: Int) {
        guard var entry = entries?[id], entry.count - amount >= 1 else { return }
        entry.count -= amount
        entry.editedAt = atMillis
        entries?[id] = entry
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

    /// Total number of drinks logged, read through the adapter so a legacy
    /// session and a schema 2 session with the same drinks give the same
    /// number: the sum of every live entry's `count`, which is what the phone
    /// app's `sumSessionDrinks` shows. (The watch has no per-type unit factors,
    /// so this is a drink count, as it always was.)
    var totalUnits: Int {
        liveEntries().reduce(0) { $0 + $1.entry.count }
    }
}
