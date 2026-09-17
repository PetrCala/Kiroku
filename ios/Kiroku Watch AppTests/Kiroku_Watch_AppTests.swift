//
//  Kiroku_Watch_AppTests.swift
//  Kiroku Watch AppTests
//
//  Created by PetrCala on 29.06.2024.
//
//  Phase 3 credential-bridge tests: the applicationContext parsing in
//  SessionConnectivity, the staleness contract of StoredCredential (epoch
//  milliseconds, 60s margin), and the CredentialStore Keychain round-trip.
//

import XCTest
@testable import Kiroku_Watch_App

final class Kiroku_Watch_AppTests: XCTestCase {
    private var nowMs: Double {
        Date().timeIntervalSince1970 * 1000
    }

    override func setUpWithError() throws {
        CredentialStore.clear()
    }

    override func tearDownWithError() throws {
        CredentialStore.clear()
    }

    /// Spin the main run loop once so SessionConnectivity's async publishes land.
    private func drainMainQueue() {
        let expectation = expectation(description: "main queue drained")
        DispatchQueue.main.async { expectation.fulfill() }
        wait(for: [expectation], timeout: 1)
    }

    // MARK: - StoredCredential staleness

    func testCredentialIsFreshBeforeExpiryMargin() {
        let credential = StoredCredential(
            idToken: "token", uid: "uid", expiresAt: nowMs + 120_000, apiEnv: "dev"
        )
        XCTAssertFalse(credential.isStale)
    }

    func testCredentialIsStaleInsideExpiryMargin() {
        // 30s of life left is inside the 60s safety margin.
        let credential = StoredCredential(
            idToken: "token", uid: "uid", expiresAt: nowMs + 30_000, apiEnv: "dev"
        )
        XCTAssertTrue(credential.isStale)
    }

    func testStalenessBoundaryIsExactAtMargin() {
        let expiresAt: Double = 1_000_000
        let credential = StoredCredential(
            idToken: "token", uid: "uid", expiresAt: expiresAt, apiEnv: "dev"
        )
        XCTAssertTrue(credential.isStale(nowMs: expiresAt - StoredCredential.stalenessMarginMs))
        XCTAssertFalse(credential.isStale(nowMs: expiresAt - StoredCredential.stalenessMarginMs - 1))
    }

    func testEnvironmentMapping() {
        let dev = StoredCredential(idToken: "t", uid: "u", expiresAt: 0, apiEnv: "dev")
        let prod = StoredCredential(idToken: "t", uid: "u", expiresAt: 0, apiEnv: "prod")
        let unknown = StoredCredential(idToken: "t", uid: "u", expiresAt: 0, apiEnv: "staging")
        XCTAssertEqual(dev.environment, .dev)
        XCTAssertEqual(prod.environment, .prod)
        // Unknown values fail toward prod, where a mismatched token is rejected.
        XCTAssertEqual(unknown.environment, .prod)
    }

    // MARK: - CredentialStore

    func testCredentialStoreRoundTrip() {
        let credential = StoredCredential(
            idToken: "round-trip-token", uid: "uid-1", expiresAt: nowMs + 3_600_000, apiEnv: "dev"
        )
        CredentialStore.save(credential)
        XCTAssertEqual(CredentialStore.load(), credential)
        XCTAssertEqual(CredentialStore.validToken(), "round-trip-token")

        CredentialStore.clear()
        XCTAssertNil(CredentialStore.load())
        XCTAssertNil(CredentialStore.validToken())
    }

    func testValidTokenIsNilWhenStale() {
        let credential = StoredCredential(
            idToken: "stale-token", uid: "uid-1", expiresAt: nowMs - 1_000, apiEnv: "dev"
        )
        CredentialStore.save(credential)
        XCTAssertNotNil(CredentialStore.load(), "stale credentials stay loadable")
        XCTAssertNil(CredentialStore.validToken(), "but never usable as a token")
    }

    // MARK: - SessionConnectivity.apply

    func testApplyFullPayloadStoresCredentialAndDecodesSession() {
        let expiresAt = nowMs + 3_600_000
        // The unknown key mirrors JS-only fields; the decoder must ignore them.
        let ongoingJSON = """
        {"id":"-Abc123","start_time":1700000000000,"end_time":1700000000000,\
        "blackout":false,"note":"","timezone":"Europe/Prague","type":"live",\
        "ongoing":true,"drinks":{"1700000001000":{"beer":2}},"someUnknownKey":1}
        """
        SessionConnectivity.shared.apply([
            "v": 1,
            "signedIn": true,
            "idToken": "pushed-token",
            "uid": "uid-42",
            "expiresAt": expiresAt,
            "apiEnv": "dev",
            "ongoingSession": ongoingJSON,
        ])
        drainMainQueue()

        let stored = CredentialStore.load()
        XCTAssertEqual(stored?.idToken, "pushed-token")
        XCTAssertEqual(stored?.uid, "uid-42")
        XCTAssertEqual(stored?.expiresAt, expiresAt)
        XCTAssertEqual(stored?.apiEnv, "dev")

        XCTAssertEqual(SessionConnectivity.shared.credential, stored)
        XCTAssertFalse(SessionConnectivity.shared.needsPhoneReconnect)

        let session = SessionConnectivity.shared.ongoingSession
        XCTAssertEqual(session?.id, "-Abc123")
        XCTAssertEqual(session?.startTime, 1_700_000_000_000)
        XCTAssertEqual(session?.type, .live)
        XCTAssertEqual(session?.ongoing, true)
        XCTAssertEqual(session?.totalUnits, 2)
    }

    func testApplyDecodesASchema2SessionAndTheSchemaFlag() {
        let ongoingJSON = """
        {"id":"-V2abc","start_time":1700000000000,"end_time":1700000005000,\
        "blackout":false,"note":"","timezone":"Europe/Prague","type":"live",\
        "ongoing":true,"schema_version":2,"name":"Friday evening","visibility":"friends",\
        "entries":{"a":{"ts":1700000001000,"key":"beer","count":2,"source":"phone",\
        "author_uid":"uid-42","target_uid":"uid-42","created_at":1700000001000},\
        "b":{"ts":1700000002000,"key":"wine","count":1,"source":"phone",\
        "author_uid":"uid-42","target_uid":"uid-42","created_at":1700000002000,"deleted":true}}}
        """
        SessionConnectivity.shared.apply([
            "v": 1,
            "signedIn": true,
            "idToken": "pushed-token",
            "uid": "uid-42",
            "expiresAt": nowMs + 3_600_000,
            "apiEnv": "dev",
            "ongoingSession": ongoingJSON,
            "sessionsV2Schema": true,
        ])
        drainMainQueue()

        let session = SessionConnectivity.shared.ongoingSession
        XCTAssertEqual(session?.isSchemaV2, true)
        XCTAssertEqual(session?.name, "Friday evening")
        XCTAssertEqual(session?.entries?.count, 2)
        // The tombstone does not count, exactly as on the phone.
        XCTAssertEqual(session?.totalUnits, 2)
        XCTAssertTrue(SessionConnectivity.shared.sessionsV2Schema)

        // Without the flag key the watch stays on the legacy shape.
        SessionConnectivity.shared.apply([
            "v": 1,
            "signedIn": true,
            "idToken": "pushed-token",
            "uid": "uid-42",
            "expiresAt": nowMs + 3_600_000,
            "apiEnv": "dev",
        ])
        drainMainQueue()
        XCTAssertFalse(SessionConnectivity.shared.sessionsV2Schema)
    }

    func testApplySignedOutPayloadClearsCredential() {
        CredentialStore.save(StoredCredential(
            idToken: "old", uid: "uid", expiresAt: nowMs + 3_600_000, apiEnv: "dev"
        ))
        SessionConnectivity.shared.apply(["v": 1, "signedIn": false])
        drainMainQueue()

        XCTAssertNil(CredentialStore.load())
        XCTAssertNil(SessionConnectivity.shared.credential)
        XCTAssertTrue(SessionConnectivity.shared.needsPhoneReconnect)
    }

    func testApplyMalformedOngoingSessionKeepsCredential() {
        SessionConnectivity.shared.apply([
            "v": 1,
            "signedIn": true,
            "idToken": "still-good",
            "uid": "uid-42",
            "expiresAt": nowMs + 3_600_000,
            "apiEnv": "prod",
            "ongoingSession": "{not valid json",
        ])
        drainMainQueue()

        XCTAssertEqual(CredentialStore.load()?.idToken, "still-good")
        XCTAssertNil(SessionConnectivity.shared.ongoingSession)
    }

    func testMarkCredentialRejectedClearsStoreAndPublishes() {
        SessionConnectivity.shared.apply([
            "v": 1,
            "signedIn": true,
            "idToken": "doomed",
            "uid": "uid",
            "expiresAt": nowMs + 3_600_000,
            "apiEnv": "dev",
        ])
        drainMainQueue()
        XCTAssertNotNil(SessionConnectivity.shared.credential)

        SessionConnectivity.shared.markCredentialRejected()
        drainMainQueue()

        XCTAssertNil(CredentialStore.load())
        XCTAssertNil(SessionConnectivity.shared.credential)
        XCTAssertTrue(SessionConnectivity.shared.needsPhoneReconnect)
    }
}

// MARK: - Phase 4: SessionViewModel

/// Captures what the view model posts, standing in for `KirokuAPI`.
private final class SpyWriter: SessionWriting, @unchecked Sendable {
    private(set) var started: [DrinkingSession] = []
    private(set) var updated: [DrinkingSession] = []
    private(set) var saved: [DrinkingSession] = []
    private(set) var discarded: [String] = []
    private(set) var applied: [SessionOp] = []
    var errorToThrow: KirokuAPIError?

    func start(_ session: DrinkingSession) async throws -> KirokuAPIResponse {
        started.append(session)
        return try result()
    }

    func update(_ session: DrinkingSession) async throws -> KirokuAPIResponse {
        updated.append(session)
        return try result()
    }

    func save(_ session: DrinkingSession) async throws -> KirokuAPIResponse {
        saved.append(session)
        return try result()
    }

    func discard(sessionId: String) async throws -> KirokuAPIResponse {
        discarded.append(sessionId)
        return try result()
    }

    func apply(_ op: SessionOp) async throws -> KirokuAPIResponse {
        applied.append(op)
        return try result()
    }

    /// The types of the ops that reached the writer, in order.
    var appliedTypes: [String] { applied.map(\.type) }

    private func result() throws -> KirokuAPIResponse {
        if let errorToThrow {
            throw errorToThrow
        }
        return KirokuAPIResponse(statusCode: 200, jsonCode: 200, body: Data())
    }
}

/// An in-memory op store, so a test can watch what the view model persists
/// without touching `UserDefaults`.
private final class FakeOpStore: SessionOpStoring, @unchecked Sendable {
    var stored: [SessionOp]

    init(stored: [SessionOp] = []) {
        self.stored = stored
    }

    func load() -> [SessionOp] { stored }

    func save(_ ops: [SessionOp]) { stored = ops }
}

private struct NoopHaptics: WatchHaptics {
    func play(_ type: WatchHapticType) {}
}

/// Phase 4 (docs/apple-watch-mvp.md): the view model reflects the phone's
/// ongoing session, keeps a DrinkingSession-backed count, degrades when the
/// token is missing, and drives the start -> +units -> save happy path.
@MainActor
final class SessionViewModelTests: XCTestCase {
    private var nowMs: Double { Date().timeIntervalSince1970 * 1000 }

    override func setUp() async throws {
        CredentialStore.clear()
        // Reset the shared connectivity to signed-out, no ongoing session.
        SessionConnectivity.shared.apply(["v": 1, "signedIn": false])
        await drainMain()
    }

    override func tearDown() async throws {
        CredentialStore.clear()
    }

    // MARK: Helpers

    private func drainMain() async {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            DispatchQueue.main.async { continuation.resume() }
        }
    }

    private func waitUntil(_ condition: @escaping () -> Bool, timeout: TimeInterval = 2) async {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition() && Date() < deadline {
            await drainMain()
        }
    }

    /// Sign the shared connectivity in (credential -> Keychain), optionally with
    /// an ongoing-session snapshot.
    private func signIn(env: String = "dev", ongoingJSON: String? = nil) async {
        var context: [String: Any] = [
            "v": 1,
            "signedIn": true,
            "idToken": "test-token",
            "uid": "uid-test",
            "expiresAt": nowMs + 3_600_000,
            "apiEnv": env,
        ]
        if let ongoingJSON {
            context["ongoingSession"] = ongoingJSON
        }
        SessionConnectivity.shared.apply(context)
        await drainMain()
    }

    private func makeViewModel(
        _ spy: SpyWriter,
        opStore: SessionOpStoring = FakeOpStore()
    ) -> SessionViewModel {
        SessionViewModel(
            connectivity: .shared,
            controller: LiveSessionController(),
            outbox: SessionOpOutbox(baseRetryMillis: 10, maxRetryMillis: 20),
            opStore: opStore,
            haptics: NoopHaptics(),
            makeWriter: { _, _ in spy }
        )
    }

    /// A schema 2 ongoing session, optionally carrying one entry the PHONE
    /// logged, so a test can watch the watch's ops leave it alone.
    private func v2OngoingJSON(id: String, phoneBeers: Int = 0) -> String {
        let entries = phoneBeers > 0
            ? """
            ,"entries":{"phone-1":{"ts":1700000001000,"key":"beer","count":\(phoneBeers),\
            "source":"phone","author_uid":"uid-test","target_uid":"uid-test",\
            "created_at":1700000001000}}
            """
            : ""
        return """
        {"id":"\(id)","start_time":1700000000000,"end_time":1700000000000,\
        "blackout":false,"note":"","timezone":"Europe/Prague","type":"live",\
        "ongoing":true,"schema_version":2,"visibility":"friends"\(entries)}
        """
    }

    private func ongoingJSON(id: String, beers: Int) -> String {
        """
        {"id":"\(id)","start_time":1700000000000,"end_time":1700000000000,\
        "blackout":false,"note":"","timezone":"Europe/Prague","type":"live",\
        "ongoing":true,"drinks":{"1700000001000":{"beer":\(beers)}}}
        """
    }

    // MARK: Reflecting the phone

    func testReflectsPhoneOngoingSessionOnInit() async {
        await signIn(ongoingJSON: ongoingJSON(id: "-PhoneLive", beers: 2))
        let viewModel = makeViewModel(SpyWriter())
        XCTAssertTrue(viewModel.isActive, "an ongoing phone session shows as active on open")
        XCTAssertEqual(viewModel.unitCount, 2)
        XCTAssertFalse(viewModel.needsReconnect)
    }

    func testReflectAdoptsWhenIdle() async {
        await signIn()
        let viewModel = makeViewModel(SpyWriter())
        XCTAssertFalse(viewModel.isActive)

        var session = DrinkingSession.newLive(id: "-Later", now: 1_700_000_000_000, timezone: "Europe/Prague")
        session.addDrinks(1, of: .beer, atMillis: 1_700_000_000_000)
        viewModel.reflect(session)
        XCTAssertTrue(viewModel.isActive)
        XCTAssertEqual(viewModel.unitCount, 1)
    }

    // MARK: Local units

    func testAddAndSubtractUnits() async {
        await signIn(ongoingJSON: ongoingJSON(id: "-Count", beers: 0))
        let viewModel = makeViewModel(SpyWriter())
        // A 0-drink ongoing session still reflects as active.
        XCTAssertTrue(viewModel.isActive)

        viewModel.addUnit()
        viewModel.addUnit()
        viewModel.addUnit()
        XCTAssertEqual(viewModel.unitCount, 3)

        viewModel.subtractUnit()
        XCTAssertEqual(viewModel.unitCount, 2)
    }

    func testAddAndSubtractUnitsOnASchema2Session() async {
        let ongoingJSON = """
        {"id":"-V2count","start_time":1700000000000,"end_time":1700000000000,\
        "blackout":false,"note":"","timezone":"Europe/Prague","type":"live",\
        "ongoing":true,"schema_version":2,"visibility":"friends",\
        "entries":{"p":{"ts":1700000001000,"key":"beer","count":2,"source":"phone",\
        "author_uid":"uid-test","target_uid":"uid-test","created_at":1700000001000}}}
        """
        await signIn(ongoingJSON: ongoingJSON)
        let viewModel = makeViewModel(SpyWriter())
        XCTAssertTrue(viewModel.isActive)
        XCTAssertEqual(viewModel.unitCount, 2, "the phone's entries count")

        // The signed-in uid authors the watch's entries; a subtract only ever
        // takes the watch's own back, never the phone's two beers.
        viewModel.addUnit()
        viewModel.addUnit()
        XCTAssertEqual(viewModel.unitCount, 4)
        viewModel.subtractUnit()
        viewModel.subtractUnit()
        viewModel.subtractUnit()
        XCTAssertEqual(viewModel.unitCount, 2)
    }

    // MARK: Disconnected

    func testStartBlockedWhenDisconnected() async {
        // setUp left us signed out: no credential in the Keychain.
        let spy = SpyWriter()
        let viewModel = makeViewModel(spy)
        XCTAssertTrue(viewModel.needsReconnect)

        viewModel.startSession()
        await drainMain()
        XCTAssertFalse(viewModel.isActive, "no token -> no local session, no write")
        XCTAssertTrue(spy.started.isEmpty)
    }

    // MARK: Happy path

    func testStartThenAddThenSaveHappyPath() async {
        await signIn()
        let spy = SpyWriter()
        let viewModel = makeViewModel(spy)

        viewModel.startSession()
        XCTAssertTrue(viewModel.isActive, "start is optimistic")
        await waitUntil { spy.started.count == 1 }
        let started = try? XCTUnwrap(spy.started.first)
        XCTAssertEqual(started?.ongoing, true)
        XCTAssertEqual(started?.totalUnits, 0)

        viewModel.addUnit()
        viewModel.addUnit()
        viewModel.addUnit()
        XCTAssertEqual(viewModel.unitCount, 3)

        viewModel.saveSession()
        await waitUntil { !viewModel.isActive }
        XCTAssertEqual(spy.saved.count, 1)
        XCTAssertEqual(spy.saved.first?.ongoing, false, "save finalizes the session")
        XCTAssertEqual(spy.saved.first?.totalUnits, 3)
        XCTAssertEqual(spy.saved.first?.id, started?.id, "same session, saved not duplicated")
        XCTAssertFalse(viewModel.isActive)
        XCTAssertNil(viewModel.lastError)
    }

    func testDiscardGoesIdle() async {
        await signIn(ongoingJSON: ongoingJSON(id: "-Discard", beers: 1))
        let spy = SpyWriter()
        let viewModel = makeViewModel(spy)
        XCTAssertTrue(viewModel.isActive)

        viewModel.discardSession()
        await waitUntil { !viewModel.isActive }
        XCTAssertEqual(spy.discarded, ["-Discard"])
        XCTAssertFalse(viewModel.isActive)
    }

    // MARK: Failed write

    func testFailedSaveShowsErrorAndKeepsSession() async {
        await signIn(ongoingJSON: ongoingJSON(id: "-KeepMe", beers: 1))
        let spy = SpyWriter()
        spy.errorToThrow = .server(statusCode: 500, jsonCode: nil, message: "boom")
        let viewModel = makeViewModel(spy)

        viewModel.saveSession()
        await waitUntil { viewModel.lastError != nil }
        XCTAssertNotNil(viewModel.lastError, "a failed write surfaces inline")
        XCTAssertTrue(viewModel.isActive, "the session survives so save can be retried")
    }

    func testAuthErrorRoutesToReconnect() async {
        await signIn(ongoingJSON: ongoingJSON(id: "-Revoked", beers: 1))
        let spy = SpyWriter()
        spy.errorToThrow = .tokenRevoked
        let viewModel = makeViewModel(spy)

        viewModel.saveSession()
        await waitUntil { viewModel.needsReconnect }
        XCTAssertTrue(viewModel.needsReconnect, "a revoked token drops to the reconnect state")
    }
    // MARK: Sessions v2: ops instead of whole sessions (W2)

    func testAddingADrinkOnAV2SessionSendsAnAddEntryOpAndNoWholeSession() async {
        await signIn(ongoingJSON: v2OngoingJSON(id: "-V2Ops"))
        let spy = SpyWriter()
        let viewModel = makeViewModel(spy)

        viewModel.addUnit()
        await waitUntil { spy.applied.count == 1 }

        XCTAssertEqual(spy.appliedTypes, ["add_entry"])
        XCTAssertEqual(spy.applied.first?.sessionId, "-V2Ops")
        XCTAssertEqual(spy.applied.first?.payload.source, "watch")
        // The race this closes: no whole-session write goes out at all, so
        // there is nothing that could overwrite what the phone logged.
        XCTAssertTrue(spy.updated.isEmpty)
        XCTAssertTrue(spy.saved.isEmpty)
    }

    func testEachTapIsItsOwnOpWithItsOwnEntryId() async {
        await signIn(ongoingJSON: v2OngoingJSON(id: "-V2Ops"))
        let spy = SpyWriter()
        let viewModel = makeViewModel(spy)

        viewModel.addUnit()
        viewModel.addUnit()
        viewModel.addUnit()
        await waitUntil { spy.applied.count == 3 }

        XCTAssertEqual(spy.appliedTypes, ["add_entry", "add_entry", "add_entry"])
        let entryIds = spy.applied.compactMap { $0.payload.entryId }
        XCTAssertEqual(Set(entryIds).count, 3, "no tap is folded into another")
    }

    func testSubtractingSendsADeleteOpForTheWatchsOwnEntry() async {
        await signIn(ongoingJSON: v2OngoingJSON(id: "-V2Ops", phoneBeers: 2))
        let spy = SpyWriter()
        let viewModel = makeViewModel(spy)
        XCTAssertEqual(viewModel.unitCount, 2, "the phone's drinks count")

        viewModel.addUnit()
        await waitUntil { spy.applied.count == 1 }
        viewModel.subtractUnit()
        await waitUntil { spy.applied.count == 2 }

        XCTAssertEqual(spy.appliedTypes, ["add_entry", "delete_entry"])
        // It names the watch's own entry, so the phone's two beers are
        // untouchable by construction.
        XCTAssertEqual(
            spy.applied.last?.payload.entryId,
            spy.applied.first?.payload.entryId
        )
        XCTAssertEqual(viewModel.unitCount, 2)
    }

    func testSubtractingThePhonesDrinkIsRefusedLocallyAndSendsNothing() async {
        await signIn(ongoingJSON: v2OngoingJSON(id: "-V2Ops", phoneBeers: 1))
        let spy = SpyWriter()
        let viewModel = makeViewModel(spy)

        viewModel.subtractUnit()
        await drainMain()

        XCTAssertTrue(spy.applied.isEmpty, "the watch has nothing of its own to remove")
        XCTAssertEqual(viewModel.unitCount, 1)
    }

    func testEndingAV2SessionSendsAnEndOpAndGoesIdleAtOnce() async {
        await signIn(ongoingJSON: v2OngoingJSON(id: "-V2Ops"))
        let spy = SpyWriter()
        let viewModel = makeViewModel(spy)

        viewModel.addUnit()
        await waitUntil { spy.applied.count == 1 }
        viewModel.saveSession()
        await waitUntil { spy.applied.count == 2 }

        XCTAssertEqual(spy.appliedTypes, ["add_entry", "end"])
        XCTAssertTrue(spy.saved.isEmpty, "no whole-session finalize")
        // Ending is instant and offline-safe: the outbox owes the server the
        // close, so the UI does not wait on it.
        XCTAssertFalse(viewModel.isActive)
        XCTAssertFalse(viewModel.isBusy)
    }

    func testStartingAFreshV2SessionSendsAStartOp() async {
        await signIn()
        SessionConnectivity.shared.apply([
            "v": 1,
            "signedIn": true,
            "idToken": "test-token",
            "uid": "uid-test",
            "expiresAt": nowMs + 3_600_000,
            "apiEnv": "dev",
            "sessionsV2Schema": true,
        ])
        await drainMain()
        let spy = SpyWriter()
        let viewModel = makeViewModel(spy)

        viewModel.startSession()
        await waitUntil { spy.applied.count == 1 }

        XCTAssertEqual(spy.appliedTypes, ["start"])
        XCTAssertTrue(spy.started.isEmpty, "no whole-session start")
        XCTAssertTrue(viewModel.isActive)
    }

    func testALegacySessionStillWritesWholeSessions() async {
        await signIn(ongoingJSON: ongoingJSON(id: "-Legacy", beers: 0))
        let spy = SpyWriter()
        let viewModel = makeViewModel(spy)

        viewModel.addUnit()
        viewModel.saveSession()
        await waitUntil { !spy.saved.isEmpty }

        XCTAssertTrue(spy.applied.isEmpty, "a legacy session has no entry ids to name")
        XCTAssertEqual(spy.saved.count, 1)
        XCTAssertEqual(spy.saved.first?.ongoing, false)
    }

    func testQueuedOpsArePersistedAndDrainOnTheNextLaunch() async {
        await signIn(ongoingJSON: v2OngoingJSON(id: "-V2Ops"))
        let store = FakeOpStore()
        // Offline: every send fails transiently, so the op stays queued and is
        // written to the store. A drink queued and never sent exists nowhere
        // else, which is why this has to survive a relaunch.
        let offline = SpyWriter()
        offline.errorToThrow = .network(message: "offline")
        let viewModel = makeViewModel(offline, opStore: store)

        viewModel.addUnit()
        await waitUntil { !store.stored.isEmpty }
        XCTAssertEqual(store.stored.count, 1)
        XCTAssertEqual(viewModel.pendingOpCount, 1)

        // The relaunch: a new view model over the same store, now online.
        let online = SpyWriter()
        let revived = makeViewModel(online, opStore: store)
        await waitUntil { !online.applied.isEmpty }

        XCTAssertEqual(online.appliedTypes, ["add_entry"])
        await waitUntil { store.stored.isEmpty }
        XCTAssertEqual(revived.pendingOpCount, 0)
    }

    func testARefusedOpIsDroppedSoLaterDrinksStillGoOut() async {
        await signIn(ongoingJSON: v2OngoingJSON(id: "-V2Ops"))
        let spy = SpyWriter()
        // The server refuses this exact payload; replaying it can never work.
        spy.errorToThrow = .server(statusCode: 422, jsonCode: 422, message: "nope")
        let viewModel = makeViewModel(spy)

        viewModel.addUnit()
        await waitUntil { !spy.applied.isEmpty }
        // It must not block what comes after it.
        spy.errorToThrow = nil
        viewModel.addUnit()
        await waitUntil { spy.applied.count >= 2 }

        await waitUntil { viewModel.pendingOpCount == 0 }
        XCTAssertEqual(viewModel.pendingOpCount, 0)
    }

    func testDiscardingDropsTheSessionsQueuedOps() async {
        await signIn(ongoingJSON: v2OngoingJSON(id: "-V2Ops"))
        let store = FakeOpStore()
        let offline = SpyWriter()
        offline.errorToThrow = .network(message: "offline")
        let viewModel = makeViewModel(offline, opStore: store)

        viewModel.addUnit()
        await waitUntil { !store.stored.isEmpty }

        offline.errorToThrow = nil
        viewModel.discardSession()
        await waitUntil { !offline.discarded.isEmpty }

        // The session is gone, so its queued drinks have nowhere to land;
        // sending them would only pile up refusals against a deleted id.
        XCTAssertTrue(store.stored.isEmpty)
        XCTAssertFalse(viewModel.isActive)
    }

}
