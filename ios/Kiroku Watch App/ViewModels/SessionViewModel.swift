//
//  SessionViewModel.swift
//  Kiroku Watch App
//
//  Created by PetrCala on 07.07.2024.
//
//  Phase 4 (docs/apple-watch-mvp.md): the SwiftUI views are backed by a real
//  DrinkingSession, not the old in-memory counter. This view model is a thin
//  @MainActor wrapper around the pure `LiveSessionController` (state) plus the
//  phone-bridged credential (`SessionConnectivity` / `CredentialStore`) and the
//  `KirokuAPI` client (network). It:
//    - reflects the phone's ongoing session so opening the watch mid-session
//      shows it (driven by the view's `.onReceive`, see InitialView),
//    - wires start / +1 / -1 / save / discard,
//    - exposes loading / disconnected / error state for the UI.
//
//  +/- are kept local here; the whole session is persisted on start and save.
//  Debounced live-update posting on every tap is Phase 5.
//

import Combine
import Foundation
import WatchKit

@MainActor
final class SessionViewModel: ObservableObject {
    /// Units to display (adopted phone drinks plus watch-added units).
    @Published private(set) var unitCount = 0

    /// Whether a live session is in progress (session UI vs. start screen).
    @Published private(set) var isActive = false

    /// A blocking write (save/discard) is in flight; drives the loading spinner.
    @Published private(set) var isBusy = false

    /// No usable phone credential; drives the "Open Kiroku on your phone" state.
    @Published private(set) var needsReconnect = true

    /// WCSession has not finished activating yet; drives the initial loading
    /// state (resolves to the start screen or an adopted session once ready).
    @Published private(set) var isConnecting = true

    /// Inline error for the last failed write; nil after a success.
    @Published var lastError: String?

    private let connectivity: SessionConnectivity
    private let controller: LiveSessionController
    private let haptics: WatchHaptics
    private let makeWriter: (KirokuEnvironment, @escaping @Sendable () -> String?) -> SessionWriting

    init(
        connectivity: SessionConnectivity = .shared,
        controller: LiveSessionController = LiveSessionController(),
        haptics: WatchHaptics = SystemWatchHaptics(),
        makeWriter: @escaping (KirokuEnvironment, @escaping @Sendable () -> String?) -> SessionWriting = {
            KirokuAPI(environment: $0, tokenProvider: $1)
        }
    ) {
        self.connectivity = connectivity
        self.controller = controller
        self.haptics = haptics
        self.makeWriter = makeWriter

        // Seed from whatever the phone has already delivered so a cold start with
        // a live session on the phone shows it right away.
        controller.reflectOngoing(connectivity.ongoingSession)
        needsReconnect = connectivity.needsPhoneReconnect
        isConnecting = !connectivity.isActivated
        syncPublished()
    }

    // MARK: - Connectivity glue (driven by the view's `.onReceive`)

    /// Adopt a newly delivered phone ongoing session when idle.
    func reflect(_ session: DrinkingSession?) {
        if controller.reflectOngoing(session) {
            syncPublished()
        }
    }

    /// Recompute credential-derived state after a credential or activation change.
    func refreshConnectivity() {
        needsReconnect = connectivity.needsPhoneReconnect
        isConnecting = !connectivity.isActivated
    }

    // MARK: - Actions

    func startSession() {
        guard let writer = currentWriter() else {
            haptics.play(.failure)
            return
        }
        let session = controller.begin(
            adopting: connectivity.ongoingSession,
            newId: PushID.generate()
        )
        syncPublished()
        haptics.play(.start)
        lastError = nil
        // Optimistic: the session is live locally now; the POST runs in the
        // background. A hard failure surfaces inline but keeps the session so
        // the user can keep logging and save later (save re-posts the whole
        // session). An auth failure routes to the reconnect state.
        perform { try await writer.start(session) }
    }

    func addUnit() {
        guard controller.addUnit() else { return }
        haptics.play(.click)
        syncPublished()
    }

    func subtractUnit() {
        guard controller.subtractUnit() else { return }
        haptics.play(.click)
        syncPublished()
    }

    func saveSession() {
        guard let finalized = controller.makeFinalized() else { return }
        guard let writer = currentWriter() else {
            haptics.play(.failure)
            return
        }
        runBlocking(
            work: { try await writer.save(finalized) },
            onSuccess: { self.controller.markFinished() }
        )
    }

    func discardSession() {
        guard let session = controller.currentSession() else { return }
        guard let writer = currentWriter() else {
            haptics.play(.failure)
            return
        }
        runBlocking(
            work: { try await writer.discard(sessionId: session.id) },
            onSuccess: { self.controller.markFinished() }
        )
    }

    // MARK: - Internals

    private func syncPublished() {
        unitCount = controller.unitCount
        isActive = controller.isActive
    }

    /// A writer for the current credential, or nil when the token is stale or
    /// absent. In that case it drops the dead credential so the reconnect state
    /// appears immediately; the phone's next push restores it.
    private func currentWriter() -> SessionWriting? {
        guard let credential = CredentialStore.load(), !credential.isStale else {
            connectivity.markCredentialRejected()
            needsReconnect = true
            return nil
        }
        return makeWriter(credential.environment) { CredentialStore.validToken() }
    }

    /// Run a non-blocking write (start): map errors, no spinner.
    private func perform(_ operation: @escaping () async throws -> Void) {
        Task {
            do {
                try await operation()
                self.lastError = nil
            } catch let error as KirokuAPIError {
                self.handle(error)
            } catch {
                self.reportGenericFailure()
            }
        }
    }

    /// Run a blocking write (save/discard): show the spinner, finish on success,
    /// keep the session and surface an error on failure so it can be retried.
    private func runBlocking(
        work: @escaping () async throws -> Void,
        onSuccess: @escaping () -> Void
    ) {
        lastError = nil
        isBusy = true
        Task {
            defer { self.isBusy = false }
            do {
                try await work()
                onSuccess()
                self.syncPublished()
                self.haptics.play(.success)
            } catch let error as KirokuAPIError {
                self.handle(error)
            } catch {
                self.reportGenericFailure()
            }
        }
    }

    /// Route a typed API error: auth failures go to the reconnect state, anything
    /// else is an inline, retryable error.
    private func handle(_ error: KirokuAPIError) {
        switch error {
        case .missingToken, .tokenExpired, .tokenRevoked:
            // The server disagreed with our local expiry check, or the token was
            // revoked. Either way it's unusable; recover via the phone.
            connectivity.markCredentialRejected()
            needsReconnect = true
            haptics.play(.failure)
        case .server, .network, .invalidResponse:
            reportGenericFailure()
        }
    }

    private func reportGenericFailure() {
        lastError = Translate.getText(for: "errorMessage")
        haptics.play(.failure)
    }
}

// MARK: - Seams

/// The subset of `KirokuAPI` the view model drives, as a protocol so tests can
/// substitute a spy. `KirokuAPI` satisfies it as-is.
protocol SessionWriting {
    @discardableResult func start(_ session: DrinkingSession) async throws -> KirokuAPIResponse
    @discardableResult func save(_ session: DrinkingSession) async throws -> KirokuAPIResponse
    @discardableResult func discard(sessionId: String) async throws -> KirokuAPIResponse
}

extension KirokuAPI: SessionWriting {}

/// The haptic feedback the view model fires, behind a protocol so tests run
/// without touching real hardware.
enum WatchHapticType {
    case start
    case click
    case success
    case failure
}

protocol WatchHaptics {
    func play(_ type: WatchHapticType)
}

/// Plays haptics through the real watch Taptic engine.
struct SystemWatchHaptics: WatchHaptics {
    func play(_ type: WatchHapticType) {
        let device = WKInterfaceDevice.current()
        switch type {
        case .start:
            device.play(.start)
        case .click:
            device.play(.click)
        case .success:
            device.play(.success)
        case .failure:
            device.play(.failure)
        }
    }
}
