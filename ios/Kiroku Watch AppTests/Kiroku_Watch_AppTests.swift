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
    private(set) var saved: [DrinkingSession] = []
    private(set) var discarded: [String] = []
    var errorToThrow: KirokuAPIError?

    func start(_ session: DrinkingSession) async throws -> KirokuAPIResponse {
        started.append(session)
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

    private func result() throws -> KirokuAPIResponse {
        if let errorToThrow {
            throw errorToThrow
        }
        return KirokuAPIResponse(statusCode: 200, jsonCode: 200, body: Data())
    }
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

    private func makeViewModel(_ spy: SpyWriter) -> SessionViewModel {
        SessionViewModel(
            connectivity: .shared,
            controller: LiveSessionController(),
            haptics: NoopHaptics(),
            makeWriter: { _, _ in spy }
        )
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
}
