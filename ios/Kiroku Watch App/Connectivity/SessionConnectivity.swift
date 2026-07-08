//
//  SessionConnectivity.swift
//  Kiroku Watch App
//
//  Watch-side half of the Phase 3 credential bridge (docs/apple-watch-mvp.md).
//  The phone's `WatchBridge` native module pushes an application context with
//  the Firebase credential and the current ongoing-session snapshot; this class
//  receives it, caches the credential in the Keychain (CredentialStore), and
//  publishes both to the view model.
//
//  Wire contract (all plist-safe; `ongoingSession` travels as a JSON string):
//    v: Int (schema version, 1)
//    signedIn: Bool (false means: clear the cached credential)
//    idToken: String, uid: String, expiresAt: Double (epoch ms), apiEnv: String
//    ongoingSession: String (JSON of DrinkingSession fields; absent when none)
//

import Combine
import Foundation
import WatchConnectivity

/// Receives credential + ongoing-session pushes from the phone over
/// `WCSession`. `updateApplicationContext` is last-value-wins and delivered in
/// the background, and WCSession persists the last received context across
/// launches, so between the Keychain and `receivedApplicationContext` a
/// cold-started watch app has the newest credential the phone ever sent.
final class SessionConnectivity: NSObject, ObservableObject {
    static let shared = SessionConnectivity()

    /// The last credential received from the phone (or restored from the
    /// Keychain on launch). Nil after a phone sign-out or before first pairing.
    @Published private(set) var credential: StoredCredential?

    /// The phone's ongoing live-session snapshot, when one exists. The watch
    /// adopts its id so watch taps land in the same session (no duplicate).
    @Published private(set) var ongoingSession: DrinkingSession?

    /// Whether `WCSession` finished activating.
    @Published private(set) var isActivated = false

    /// True when the watch has no usable token, which drives the
    /// "Open Kiroku on your phone to reconnect." UI. Time passing can flip
    /// this without a publish; action paths re-check via `CredentialStore`.
    var needsPhoneReconnect: Bool {
        guard let credential else {
            return true
        }
        return credential.isStale
    }

    override private init() {
        super.init()
        // Restore from the Keychain first so a cold start is signed in even
        // before WCSession activates or delivers anything.
        credential = CredentialStore.load()
        guard WCSession.isSupported() else {
            return
        }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    /// Apply a received application context. Internal so unit tests can drive
    /// it with hand-built dictionaries (no WCSession involved).
    func apply(_ context: [String: Any]) {
        let signedIn = context["signedIn"] as? Bool ?? false
        var newCredential: StoredCredential?
        if signedIn,
           let idToken = context["idToken"] as? String, !idToken.isEmpty,
           let uid = context["uid"] as? String,
           let expiresAt = (context["expiresAt"] as? NSNumber)?.doubleValue {
            newCredential = StoredCredential(
                idToken: idToken,
                uid: uid,
                expiresAt: expiresAt,
                apiEnv: context["apiEnv"] as? String ?? "prod"
            )
        }

        // Tolerant decode: a snapshot that fails to parse leaves the session
        // nil without discarding the credential.
        var newSession: DrinkingSession?
        if let json = context["ongoingSession"] as? String,
           let data = json.data(using: .utf8) {
            newSession = try? JSONDecoder().decode(DrinkingSession.self, from: data)
        }

        if let newCredential {
            CredentialStore.save(newCredential)
        } else {
            CredentialStore.clear()
        }

        DispatchQueue.main.async {
            self.credential = newCredential
            self.ongoingSession = newSession
        }
    }

    /// The cached token turned out unusable (stale by time at action time, or
    /// the API answered 401/407). Drop it and publish, so the reconnect banner
    /// appears immediately; the phone's next push restores the credential.
    func markCredentialRejected() {
        CredentialStore.clear()
        DispatchQueue.main.async {
            self.credential = nil
        }
    }
}

extension SessionConnectivity: WCSessionDelegate {
    // watchOS only requires this activation callback (the DidBecomeInactive /
    // DidDeactivate pair is iOS-side, for multi-watch handoff).
    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        DispatchQueue.main.async {
            self.isActivated = activationState == .activated
        }
        // Cold-start path: WCSession persists the last delivered context, so a
        // push sent while the watch app was dead is available right here.
        let persisted = session.receivedApplicationContext
        if !persisted.isEmpty {
            apply(persisted)
        }
    }

    func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        apply(applicationContext)
    }
}
