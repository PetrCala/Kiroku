import Foundation

/// A session op: one small, idempotent change the server applies
/// (Sessions v2 RFC §5.1). The watch sends these instead of whole sessions for
/// a `schema_version: 2` session.
///
/// **Why this replaces the whole-session PUT.** `/v1/sessions/update` is
/// last-writer-wins on the entire session, so the watch and the phone writing
/// during the same night overwrite each other: whichever PUT lands last wins,
/// and the other device's drinks are gone. That is the live bug this closes.
/// An op names only what it changes, and the watch's entries have ids no other
/// writer uses, so two devices logging at the same moment touch disjoint keys
/// and neither can lose a drink.
///
/// Every op is **absolute**: it names the value a field must end up with, never
/// a delta. That is what makes it safe to replay, which matters more on the
/// watch than on the phone, because the watch retries from its own outbox
/// (``SessionOpOutbox``) rather than from a queue the OS persists for it.
public struct SessionOp: Codable, Equatable, Sendable {
    /// Client-generated id. Also travels as the request's `Idempotency-Key`, so
    /// a replay is answered from the server's record instead of being applied a
    /// second time.
    public var opId: String

    /// The session the op applies to.
    public var sessionId: String

    /// Which change this is (`start`, `add_entry`, …).
    public var type: String

    /// Per-type fields. Encoded as JSON, so it is held as a typed payload
    /// rather than a loose dictionary (watchOS has no `JSONSerialization`
    /// round trip worth relying on for `Codable` interop).
    public var payload: Payload

    /// The watch's clock when the op was made (ms). Diagnostics only: the
    /// server stamps `created_at` itself and never orders by client time
    /// (RFC §5.5).
    public var clientTs: Int

    enum CodingKeys: String, CodingKey {
        case opId
        case sessionId
        case type
        case payload
        case clientTs = "client_ts"
    }

    public init(
        opId: String,
        sessionId: String,
        type: OpType,
        payload: Payload,
        clientTs: Int
    ) {
        self.opId = opId
        self.sessionId = sessionId
        self.type = type.rawValue
        self.payload = payload
        self.clientTs = clientTs
    }

    /// The op types the watch sends. A subset of the server's list: the watch
    /// starts, ends and logs drinks, and never touches a shared session.
    public enum OpType: String, Codable, Sendable {
        case start
        case end
        case addEntry = "add_entry"
        case editEntry = "edit_entry"
        case deleteEntry = "delete_entry"
    }

    /// The union of the fields the watch's ops carry. One struct with optional
    /// fields rather than a per-type enum: every field is absent unless the op
    /// needs it, the encoder drops the absent ones, and the server validates
    /// per type anyway.
    public struct Payload: Codable, Equatable, Sendable {
        // `start`
        public var startTime: Int?
        public var timezone: String?
        public var type: String?
        public var visibility: String?

        // `start` and `end`. One field, because it means the same thing to
        // both: the session's end time.
        public var endTime: Int?

        // the entry ops
        public var entryId: String?
        public var ts: Int?
        public var key: String?
        public var count: Int?
        public var volumeMl: Double?
        public var abv: Double?
        public var source: String?

        enum CodingKeys: String, CodingKey {
            case startTime = "start_time"
            case timezone
            case type
            case visibility
            case endTime = "end_time"
            case entryId
            case ts
            case key
            case count
            case volumeMl = "volume_ml"
            case abv
            case source
        }

        public init(
            startTime: Int? = nil,
            timezone: String? = nil,
            type: String? = nil,
            visibility: String? = nil,
            endTime: Int? = nil,
            entryId: String? = nil,
            ts: Int? = nil,
            key: String? = nil,
            count: Int? = nil,
            volumeMl: Double? = nil,
            abv: Double? = nil,
            source: String? = nil
        ) {
            self.startTime = startTime
            self.timezone = timezone
            self.type = type
            self.visibility = visibility
            self.endTime = endTime
            self.entryId = entryId
            self.ts = ts
            self.key = key
            self.count = count
            self.volumeMl = volumeMl
            self.abv = abv
            self.source = source
        }
    }
}

// MARK: - Builders

public extension SessionOp {
    /// `start`: create the session the watch just began. Carries the meta the
    /// server needs; the server stamps `ongoing` from the session's type.
    static func start(
        _ session: DrinkingSession,
        opId: String = PushID.generate(),
        now: Int = DrinkingSession.nowMillis()
    ) -> SessionOp {
        SessionOp(
            opId: opId,
            sessionId: session.id,
            type: .start,
            payload: Payload(
                startTime: session.startTime,
                timezone: session.timezone,
                type: session.type.rawValue,
                visibility: session.visibility ?? DrinkingSession.defaultVisibility,
                endTime: session.endTime
            ),
            clientTs: now
        )
    }

    /// `end`: close the session at `endTime`.
    static func end(
        sessionId: String,
        endTime: Int,
        opId: String = PushID.generate(),
        now: Int = DrinkingSession.nowMillis()
    ) -> SessionOp {
        SessionOp(
            opId: opId,
            sessionId: sessionId,
            type: .end,
            payload: Payload(endTime: endTime),
            clientTs: now
        )
    }

    /// `add_entry`: one drink logged on the watch. The entry id is the watch's
    /// own (a push id), which is why a phone logging at the same moment cannot
    /// collide: the two writes name different keys.
    static func addEntry(
        sessionId: String,
        entryId: String,
        entry: SessionEntry,
        opId: String = PushID.generate(),
        now: Int = DrinkingSession.nowMillis()
    ) -> SessionOp {
        SessionOp(
            opId: opId,
            sessionId: sessionId,
            type: .addEntry,
            payload: Payload(
                entryId: entryId,
                ts: entry.ts,
                key: entry.key,
                count: entry.count,
                volumeMl: entry.volumeMl,
                abv: entry.abv,
                source: entry.source
            ),
            clientTs: now
        )
    }

    /// `edit_entry`: the new count of an entry the watch is reducing. Absolute,
    /// so a replay lands the same count rather than reducing twice.
    static func editEntryCount(
        sessionId: String,
        entryId: String,
        count: Int,
        opId: String = PushID.generate(),
        now: Int = DrinkingSession.nowMillis()
    ) -> SessionOp {
        SessionOp(
            opId: opId,
            sessionId: sessionId,
            type: .editEntry,
            payload: Payload(entryId: entryId, count: count),
            clientTs: now
        )
    }

    /// `delete_entry`: tombstone one of the watch's own entries. The server
    /// keeps the key (RFC §4.3), so this can never remove a drink the phone
    /// logged, even by accident.
    static func deleteEntry(
        sessionId: String,
        entryId: String,
        opId: String = PushID.generate(),
        now: Int = DrinkingSession.nowMillis()
    ) -> SessionOp {
        SessionOp(
            opId: opId,
            sessionId: sessionId,
            type: .deleteEntry,
            payload: Payload(entryId: entryId),
            clientTs: now
        )
    }
}
