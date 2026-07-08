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
