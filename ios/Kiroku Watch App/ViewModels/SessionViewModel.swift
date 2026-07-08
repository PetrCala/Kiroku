//
//  SessionViewModel.swift
//  Kiroku Watch App
//
//  Created by PetrCala on 07.07.2024.
//
//  Phase 3 (docs/apple-watch-mvp.md) wires the existing local counter UI to the
//  real kiroku-api through the phone-bridged credential: start/save/discard now
//  POST the session using the Keychain-cached token from CredentialStore.
//  Phase 4 replaces SessionModel with fully DrinkingSession-backed state.
//

import Combine
import Foundation

@MainActor
class SessionViewModel: ObservableObject {
    @Published var session = SessionModel.shared

    /// Inline error for a failed write; nil when the last operation succeeded.
    @Published var lastError: String?

    private let connectivity = SessionConnectivity.shared

    /// The session being logged, in wire form. Seeded on start (adopting the
    /// phone's ongoing session when there is one) and posted whole on save.
    private var liveSession: DrinkingSession?

    func startSession() {
        session.startSession()
        guard let api = makeAPI() else {
            return
        }
        // Adopt the phone's ongoing session when one exists so watch taps land
        // in the same session (no duplicate); mint a new push id otherwise.
        var newSession = connectivity.ongoingSession
            ?? DrinkingSession.newLive(id: PushID.generate())
        newSession.ongoing = true
        liveSession = newSession
        let sessionToStart = newSession
        perform { try await api.start(sessionToStart) }
    }

    func saveSession() {
        let count = session.unitCount
        session.saveSession()
        guard let api = makeAPI(), var finished = liveSession else {
            return
        }
        liveSession = nil
        // The MVP logs a single generic unit type; map the counter onto
        // `.other`, on top of whatever an adopted phone session already had.
        if count > finished.totalUnits {
            finished.addDrinks(count - finished.totalUnits, of: .other)
        }
        finished.endTime = DrinkingSession.nowMillis()
        finished.ongoing = false
        let sessionToSave = finished
        perform { try await api.save(sessionToSave) }
    }

    func discardSession() {
        session.discardSession()
        guard let api = makeAPI(), let live = liveSession else {
            return
        }
        liveSession = nil
        perform { try await api.discard(sessionId: live.id) }
    }

    func addUnit() {
        // Local only; the whole session posts on save.
        session.addUnit()
    }

    func subtractUnit() {
        session.subtractUnit()
    }

    /// An API client backed by the cached credential, or nil when the token is
    /// absent/stale, in which case the reconnect banner (driven by
    /// SessionConnectivity) takes over.
    private func makeAPI() -> KirokuAPI? {
        guard let credential = CredentialStore.load(), !credential.isStale else {
            // Drop the dead credential so the banner appears now instead of on
            // the next delivery; the phone's next push restores it.
            connectivity.markCredentialRejected()
            return nil
        }
        return KirokuAPI(environment: credential.environment) {
            CredentialStore.validToken()
        }
    }

    private func perform(_ operation: @escaping () async throws -> Void) {
        Task {
            do {
                try await operation()
                lastError = nil
            } catch KirokuAPIError.missingToken,
                    KirokuAPIError.tokenExpired,
                    KirokuAPIError.tokenRevoked {
                // The server disagreed with our local expiry check: the token
                // is unusable either way. Same recovery as stale-by-time.
                connectivity.markCredentialRejected()
            } catch {
                lastError = Translate.getText(for: "errorMessage")
            }
        }
    }
}
