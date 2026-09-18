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
//  Phase 5 added debounced live-update posting for a LEGACY session: +/- stay
//  instant locally and, via the pure `LiveUpdateCoalescer`, coalesce into a
//  single `/v1/sessions/update` PUT once tapping pauses (~500ms), single-flight
//  so writes never race.
//
//  Sessions v2 W2 replaces that for a `schema_version: 2` session. Each +/- is
//  one op naming only the entry it changes, sent through `SessionOpOutbox`
//  (in order, retried, persisted). That is what closes the watch/phone
//  overwrite race: the whole-session PUT is last-writer-wins on the entire
//  session, so a watch write and a phone write during the same night threw away
//  each other's drinks. Ops touch disjoint keys, so neither device can lose one.
//  The debounce is gone with it: there is nothing to coalesce, because every tap
//  is a different entry.
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

    /// How many ops are still waiting to reach the server. Drives the "not
    /// synced yet" hint, so a user who logged drinks offline can see that the
    /// watch is still holding them.
    @Published private(set) var pendingOpCount = 0

    private let connectivity: SessionConnectivity
    private let controller: LiveSessionController
    private let coalescer: LiveUpdateCoalescer
    private let outbox: SessionOpOutbox
    private let opStore: SessionOpStoring
    private let haptics: WatchHaptics
    private let makeWriter: (KirokuEnvironment, @escaping @Sendable () -> String?) -> SessionWriting

    /// The armed debounce timer for the pending live update, if any.
    private var debounceTask: Task<Void, Never>?
    /// The in-flight live-update PUT, if any. Save/discard awaits it so a
    /// finalizing write is ordered after any update already on the wire.
    private var flushTask: Task<Void, Never>?
    /// The armed op retry timer, if any.
    private var opRetryTask: Task<Void, Never>?
    /// The op currently on the wire, if any.
    private var opSendTask: Task<Void, Never>?

    init(
        connectivity: SessionConnectivity = .shared,
        controller: LiveSessionController = LiveSessionController(),
        coalescer: LiveUpdateCoalescer = LiveUpdateCoalescer(),
        outbox: SessionOpOutbox = SessionOpOutbox(),
        opStore: SessionOpStoring = SessionOpStore(),
        haptics: WatchHaptics = SystemWatchHaptics(),
        makeWriter: @escaping (KirokuEnvironment, @escaping @Sendable () -> String?) -> SessionWriting = {
            KirokuAPI(environment: $0, tokenProvider: $1)
        }
    ) {
        self.connectivity = connectivity
        self.controller = controller
        self.coalescer = coalescer
        self.outbox = outbox
        self.opStore = opStore
        self.haptics = haptics
        self.makeWriter = makeWriter

        // Seed from whatever the phone has already delivered so a cold start with
        // a live session on the phone shows it right away.
        controller.reflectOngoing(connectivity.ongoingSession)
        needsReconnect = connectivity.needsPhoneReconnect
        isConnecting = !connectivity.isActivated
        // Ops queued before the app was killed are still owed to the server;
        // pick them up and keep draining.
        outbox.restore(opStore.load())
        syncPublished()
        driveOutbox(outbox.resume())
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
        // Drop any stale debounced update left over from a previous session so it
        // can't land against the id we are about to begin.
        cancelLivePersist()
        let session = controller.begin(
            adopting: connectivity.ongoingSession,
            newId: PushID.generate(),
            schemaV2: connectivity.sessionsV2Schema
        )
        syncPublished()
        haptics.play(.start)
        lastError = nil
        // A Sessions v2 session starts with a `start` op, which the outbox
        // delivers and retries; there is nothing to surface inline, because a
        // failure is not the user's to fix. A legacy session keeps the
        // optimistic whole-session POST: it is live locally now, a hard failure
        // surfaces inline but keeps the session, and the save re-posts it.
        if drainControllerOps() {
            return
        }
        perform { try await writer.start(session) }
    }

    func addUnit() {
        // A Sessions v2 entry is attributed to the signed-in user; the phone's
        // credential push carries the uid.
        guard controller.addUnit(authorUid: CredentialStore.load()?.uid) else { return }
        haptics.play(.click)
        syncPublished()
        persistChange()
    }

    func subtractUnit() {
        guard controller.subtractUnit() else { return }
        haptics.play(.click)
        syncPublished()
        persistChange()
    }

    func saveSession() {
        guard controller.currentSession() != nil else { return }
        guard currentWriter() != nil else {
            haptics.play(.failure)
            return
        }
        cancelLivePersist()

        // A Sessions v2 session ends with one `end` op. The drinks are already
        // queued or delivered as their own ops, so ending is instant and
        // offline-safe: the session closes locally and the outbox owes the
        // server the close. Nothing here can fail in a way the user must fix,
        // which is why there is no spinner and no inline error.
        if let endOp = controller.makeEndOp() {
            _ = outbox.enqueue(endOp)
            _ = controller.takePendingOps()
            controller.markFinished()
            syncPublished()
            haptics.play(.success)
            lastError = nil
            persistOutbox()
            driveOutbox(outbox.resume())
            return
        }

        // Legacy: the whole session is the write, so it blocks and reports.
        // The in-flight debounced update (if any) is awaited in `runBlocking`
        // so this save is ordered last (last-writer-wins).
        guard let finalized = controller.makeFinalized(), let writer = currentWriter() else {
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
        cancelLivePersist()
        // The session is about to be deleted, so its queued ops have nowhere to
        // land. Drop them before the delete rather than after: a `delete`
        // landing first would leave the ops piling up refusals against a
        // session id that no longer exists.
        outbox.dropOps(forSessionId: session.id)
        persistOutbox()
        runBlocking(
            work: { try await writer.discard(sessionId: session.id) },
            onSuccess: { self.controller.markFinished() }
        )
    }

    /// Resume delivering queued ops. Called when the watch app becomes active,
    /// because an op left over from a previous run (or from an offline stretch)
    /// is a drink the server does not have yet.
    func resumeOutbox() {
        driveOutbox(outbox.resume())
    }

    // MARK: - Op outbox (Sessions v2 W2)

    /// Persist a local change: ops for a Sessions v2 session, the debounced
    /// whole-session update for a legacy one.
    private func persistChange() {
        if drainControllerOps() {
            return
        }
        scheduleLivePersist()
    }

    /// Move whatever ops the controller recorded into the outbox and start
    /// delivering. Returns whether there were any, which is also the answer to
    /// "is this session on the op path?" for the caller.
    @discardableResult
    private func drainControllerOps() -> Bool {
        let ops = controller.takePendingOps()
        guard !ops.isEmpty else {
            return false
        }
        var command = SessionOpOutbox.Command.none
        for op in ops {
            let next = outbox.enqueue(op)
            // Only one of the enqueues can start a send (the outbox is
            // single-flight); keep whichever command is not `.none`.
            if next != .none {
                command = next
            }
        }
        persistOutbox()
        driveOutbox(command)
        return true
    }

    /// Act on an outbox command, and keep `pendingOpCount` in step.
    private func driveOutbox(_ command: SessionOpOutbox.Command) {
        pendingOpCount = outbox.pendingCount
        switch command {
        case .none:
            break
        case let .send(op):
            sendOp(op)
        case let .scheduleRetry(generation, delayMillis):
            armOpRetry(generation: generation, delayMillis: delayMillis)
        }
    }

    /// Send one op and report its outcome back to the outbox.
    ///
    /// A missing or stale credential is treated as TRANSIENT, not as a refusal:
    /// the drink is real and the phone's next credential push makes the send
    /// possible, so dropping it would lose a drink over a recoverable problem.
    private func sendOp(_ op: SessionOp) {
        guard let writer = currentWriter() else {
            driveOutbox(outbox.sendCompleted(.transient))
            return
        }
        opSendTask = Task { [weak self] in
            guard let self else { return }
            var outcome = SessionOpOutbox.Outcome.success
            do {
                try await writer.apply(op)
            } catch let error as KirokuAPIError {
                self.handleBackgroundSyncError(error)
                outcome = error.isDeterministicRefusal ? .refused : .transient
            } catch {
                outcome = .transient
            }
            self.opSendTask = nil
            self.persistOutbox()
            self.driveOutbox(self.outbox.sendCompleted(outcome))
        }
    }

    /// Arm the retry timer the outbox asked for. A stale fire is a no-op inside
    /// the outbox (generation), same as the debounce timer.
    private func armOpRetry(generation: Int, delayMillis: Int) {
        opRetryTask?.cancel()
        opRetryTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delayMillis) * 1_000_000)
            guard let self, !Task.isCancelled else { return }
            self.opRetryTask = nil
            self.driveOutbox(self.outbox.retryTimerFired(generation: generation))
        }
    }

    /// Write the queue to disk. Called after every change, because the drinks
    /// in it exist nowhere else.
    private func persistOutbox() {
        opStore.save(outbox.snapshot())
        pendingOpCount = outbox.pendingCount
    }

    // MARK: - Live-update coalescing (Phase 5, legacy sessions)

    /// Feed a +/- edit to the coalescer and act on its command. LEGACY ONLY: a
    /// Sessions v2 session sends ops instead (see ``persistChange()``). The
    /// whole session is read at flush time, so the newest drinks are always
    /// sent.
    private func scheduleLivePersist() {
        apply(coalescer.schedule())
    }

    /// Stop the debounce timer and drop the coalescer's pending state so no new
    /// debounced update starts. Any already in-flight flush is left running and
    /// awaited by the finalizing save/discard for correct ordering.
    private func cancelLivePersist() {
        coalescer.cancel()
        debounceTask?.cancel()
        debounceTask = nil
    }

    private func apply(_ command: LiveUpdateCoalescer.Command) {
        switch command {
        case .none:
            break
        case let .scheduleTimer(generation, delayMillis):
            armDebounce(generation: generation, delayMillis: delayMillis)
        case .flush:
            flushLiveUpdate()
        }
    }

    /// Arm (or re-arm) the quiet-window timer. The view model is `@MainActor`, so
    /// the unstructured `Task` inherits the main actor and touches state safely
    /// after the sleep. A stale fire is a no-op inside the coalescer (generation).
    private func armDebounce(generation: Int, delayMillis: Int) {
        debounceTask?.cancel()
        debounceTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delayMillis) * 1_000_000)
            guard let self, !Task.isCancelled else { return }
            self.debounceTask = nil
            self.apply(self.coalescer.timerFired(generation: generation))
        }
    }

    /// Send one whole-session update PUT for the current live session, quietly.
    /// Reads the latest session at call time. Auth failures route to reconnect
    /// (same as Phase 4); every other failure is swallowed so a transient network
    /// blip never disturbs an active session (the authoritative save re-sends).
    private func flushLiveUpdate() {
        guard let session = controller.currentSession(), session.ongoing else {
            // Nothing live to persist (finished between arm and flush); settle.
            apply(coalescer.flushCompleted(success: true))
            return
        }
        guard let writer = currentWriter() else {
            // No usable credential: `currentWriter` already routed to reconnect.
            apply(coalescer.flushCompleted(success: false))
            return
        }
        flushTask = Task { [weak self] in
            guard let self else { return }
            var success = false
            do {
                try await writer.update(session)
                success = true
            } catch let error as KirokuAPIError {
                self.handleBackgroundSyncError(error)
            } catch {
                // Quiet: a background sync blip must not disturb the session UI.
            }
            self.flushTask = nil
            self.apply(self.coalescer.flushCompleted(success: success))
        }
    }

    /// Route a live-update (background sync) error: auth failures recover via the
    /// phone (same as Phase 4), everything else stays silent. No haptics or inline
    /// error, since the user did not initiate this write.
    private func handleBackgroundSyncError(_ error: KirokuAPIError) {
        switch error {
        case .missingToken, .tokenExpired, .tokenRevoked:
            connectivity.markCredentialRejected()
            needsReconnect = true
        case .server, .network, .invalidResponse:
            break
        }
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

    /// Run a non-blocking write (start): map errors, no spinner. Tracked in
    /// `flushTask` so a quick save/discard right after start awaits it and stays
    /// ordered last (the start POST and a finalizing PUT share the session id).
    private func perform(_ operation: @escaping () async throws -> Void) {
        flushTask = Task { [weak self] in
            guard let self else { return }
            do {
                try await operation()
                self.lastError = nil
            } catch let error as KirokuAPIError {
                self.handle(error)
            } catch {
                self.reportGenericFailure()
            }
            self.flushTask = nil
        }
    }

    /// Run a blocking write (save/discard): show the spinner, finish on success,
    /// keep the session and surface an error on failure so it can be retried. Any
    /// live-update PUT already on the wire is awaited first so this finalizing
    /// write is the last one the server sees (last-writer-wins).
    private func runBlocking(
        work: @escaping () async throws -> Void,
        onSuccess: @escaping () -> Void
    ) {
        lastError = nil
        isBusy = true
        Task {
            defer { self.isBusy = false }
            await self.flushTask?.value
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
    @discardableResult func update(_ session: DrinkingSession) async throws -> KirokuAPIResponse
    @discardableResult func save(_ session: DrinkingSession) async throws -> KirokuAPIResponse
    @discardableResult func discard(sessionId: String) async throws -> KirokuAPIResponse
    @discardableResult func apply(_ op: SessionOp) async throws -> KirokuAPIResponse
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
