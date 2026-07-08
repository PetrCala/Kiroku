//
//  WatchBridge.swift
//  Kiroku
//
//  Phone-side half of the Phase 3 credential bridge (docs/apple-watch-mvp.md).
//  JS calls `updateCredential` whenever a fresh Firebase ID token exists (login,
//  token refresh, app foreground, ongoing-session change); this module holds
//  the latest payload and pushes it to the watch via
//  `WCSession.updateApplicationContext`, which is last-value-wins and delivered
//  even when the watch app is not running.
//
//  Wire contract (applicationContext; all values plist-safe, no NSNull):
//    v: Int (schema version, 1)
//    signedIn: Bool (false means: watch clears its cached credential)
//    idToken: String, uid: String, expiresAt: Double (epoch ms), apiEnv: String
//    ongoingSession: String (JSON of DrinkingSession fields; absent when none)
//
//  Deliberately no per-push timestamp key: WCSession suppresses byte-identical
//  contexts and this module dedupes on the payload, both of which a
//  always-changing key would defeat.
//

import Foundation
import WatchConnectivity

@objc(WatchBridge)
final class WatchBridge: NSObject {
    /// Serializes all state access: RN calls arrive on the module's method
    /// queue, WCSession delegate callbacks on a WatchConnectivity thread.
    private let queue = DispatchQueue(label: "cz.kiroku.watchbridge")

    /// The latest whitelisted context from JS, held so activation completing
    /// (or the watch being paired later) can push it retroactively.
    private var latest: [String: Any]?

    /// The last successfully pushed context, for dedupe.
    private var lastPushed: NSDictionary?

    @objc
    static func requiresMainQueueSetup() -> Bool {
        false
    }

    /// Receive a fresh credential (+ optional ongoing-session JSON) from JS and
    /// push it to the watch. Whitelists and type-checks every field so nothing
    /// non-plist-safe can reach `updateApplicationContext`.
    @objc
    func updateCredential(_ credential: NSDictionary) {
        guard WCSession.isSupported() else {
            return
        }
        queue.async {
            guard let idToken = credential["idToken"] as? String, !idToken.isEmpty else {
                return
            }
            var context: [String: Any] = ["v": 1, "signedIn": true, "idToken": idToken]
            if let uid = credential["uid"] as? String {
                context["uid"] = uid
            }
            if let expiresAt = credential["expiresAt"] as? NSNumber {
                context["expiresAt"] = expiresAt.doubleValue
            }
            if let apiEnv = credential["apiEnv"] as? String {
                context["apiEnv"] = apiEnv
            }
            if let ongoingSession = credential["ongoingSession"] as? String, !ongoingSession.isEmpty {
                context["ongoingSession"] = ongoingSession
            }
            self.latest = context
            self.activateAndPush()
        }
    }

    /// Signed out on the phone: tell the watch to drop its cached credential.
    @objc
    func clearCredential() {
        guard WCSession.isSupported() else {
            return
        }
        queue.async {
            self.latest = ["v": 1, "signedIn": false]
            self.activateAndPush()
        }
    }

    /// Must be called on `queue`.
    private func activateAndPush() {
        let session = WCSession.default
        if session.delegate !== self {
            session.delegate = self
        }
        guard session.activationState == .activated else {
            // `pushIfPossible` re-runs from `activationDidCompleteWith`; the
            // payload is held in `latest`, so nothing is dropped, only delayed.
            session.activate()
            return
        }
        pushIfPossible()
    }

    /// Must be called on `queue`.
    private func pushIfPossible() {
        let session = WCSession.default
        guard session.activationState == .activated,
              session.isPaired,
              session.isWatchAppInstalled,
              let latest else {
            return
        }
        let candidate = latest as NSDictionary
        guard !candidate.isEqual(to: lastPushed as? [AnyHashable: Any] ?? [:]) else {
            return
        }
        do {
            try session.updateApplicationContext(latest)
            lastPushed = candidate
        } catch {
            // Never let a watch push take the app down; the next trigger
            // (foreground, token refresh, session change) retries.
            NSLog("[WatchBridge] updateApplicationContext failed: %@", error.localizedDescription)
        }
    }
}

extension WatchBridge: WCSessionDelegate {
    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        queue.async {
            self.pushIfPossible()
        }
    }

    // iOS-side required stubs for multi-watch handoff.
    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    /// Pairing or watch-app installation changed: re-send the held payload
    /// (dedupe reset so a re-paired watch is not skipped as "already sent").
    func sessionWatchStateDidChange(_ session: WCSession) {
        queue.async {
            self.lastPushed = nil
            self.pushIfPossible()
        }
    }
}
