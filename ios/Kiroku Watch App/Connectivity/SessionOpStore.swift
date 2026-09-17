//
//  SessionOpStore.swift
//  Kiroku Watch App
//
//  Sessions v2 W2: the watch's op outbox has to survive the app being
//  backgrounded or killed, because an op is a delta. A drink that was queued
//  and never sent is a drink that no longer exists anywhere: unlike the old
//  whole-session PUT, nothing later re-sends it.
//

import Foundation

/// Where the watch keeps its queued ops between launches.
protocol SessionOpStoring {
    /// The ops persisted by the last ``save(_:)``, oldest first.
    func load() -> [SessionOp]

    /// Replace the persisted queue. An empty array clears it.
    func save(_ ops: [SessionOp])
}

/// `UserDefaults`-backed store.
///
/// `UserDefaults` rather than the Keychain (which holds the credential): these
/// are not secrets, they are a handful of small JSON objects, and the watch app
/// is the only reader. A write happens once per queue change, which is once per
/// tap at worst.
struct SessionOpStore: SessionOpStoring {
    /// The defaults key holding the encoded queue.
    static let key = "kiroku.sessionOpOutbox.v1"

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load() -> [SessionOp] {
        guard let data = defaults.data(forKey: Self.key) else {
            return []
        }
        // A queue that cannot be decoded (a shape change across an app update)
        // is dropped rather than crashing the watch on launch. The drinks in it
        // are lost, which is why the envelope is versioned in the key.
        return (try? JSONDecoder().decode([SessionOp].self, from: data)) ?? []
    }

    func save(_ ops: [SessionOp]) {
        guard !ops.isEmpty else {
            defaults.removeObject(forKey: Self.key)
            return
        }
        guard let data = try? JSONEncoder().encode(ops) else {
            return
        }
        defaults.set(data, forKey: Self.key)
    }
}
