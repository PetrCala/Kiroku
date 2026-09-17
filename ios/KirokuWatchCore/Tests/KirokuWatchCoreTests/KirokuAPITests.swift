import XCTest
@testable import KirokuWatchCore

/// Offline tests for `KirokuAPI`: envelope/headers and the 407/401/network/server
/// mapping, driven through `MockURLProtocol` (no real network, no token needed).
final class KirokuAPITests: XCTestCase {
    private let token = "fake.dev.token"

    private func makeAPI(environment: KirokuEnvironment = .dev) -> KirokuAPI {
        KirokuAPI(environment: environment, token: token, urlSession: MockURLProtocol.makeSession())
    }

    private func makeSession() -> DrinkingSession {
        var session = DrinkingSession.newLive(id: "sess-1", now: 1_700_000_000_000, timezone: "Europe/Prague")
        session.addDrinks(2, of: .beer, atMillis: 1_700_000_000_000)
        return session
    }

    private func ok(_ request: URLRequest, json: String = "{\"jsonCode\":200}") -> (HTTPURLResponse, Data) {
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
        return (response, Data(json.utf8))
    }

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
    }

    override func tearDown() {
        MockURLProtocol.reset()
        super.tearDown()
    }

    // MARK: - Envelope + headers

    func testUpdateSendsCorrectUrlHeadersAndEnvelope() async throws {
        MockURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.absoluteString, "https://api-dev.kiroku.cz/v1/sessions/update")
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer \(self.token)")
            return self.ok(request)
        }

        let response = try await makeAPI().update(makeSession())
        XCTAssertEqual(response.statusCode, 200)
        XCTAssertEqual(response.jsonCode, 200)

        let body = try XCTUnwrap(MockURLProtocol.lastRequestBody)
        let object = try XCTUnwrap(try JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(object["sessionId"] as? String, "sess-1")
        XCTAssertEqual(object["sessionIsLive"] as? Bool, true)

        let nested = try XCTUnwrap(object["session"] as? [String: Any])
        XCTAssertEqual(nested["id"] as? String, "sess-1")
        XCTAssertEqual(nested["start_time"] as? Int, 1_700_000_000_000)
        XCTAssertEqual(nested["type"] as? String, "live")
        XCTAssertEqual(nested["ongoing"] as? Bool, true)
        let drinks = try XCTUnwrap(nested["drinks"] as? [String: Any])
        let bucket = try XCTUnwrap(drinks["1700000000000"] as? [String: Any])
        XCTAssertEqual(bucket["beer"] as? Int, 2)
    }

    func testStartHitsTheUpdateEndpoint() async throws {
        MockURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/v1/sessions/update")
            return self.ok(request)
        }
        _ = try await makeAPI().start(makeSession())
    }

    func testSaveHitsTheUpdateEndpoint() async throws {
        MockURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/v1/sessions/update")
            return self.ok(request)
        }
        var ended = makeSession()
        ended.ongoing = false
        _ = try await makeAPI().save(ended)
        // The save envelope still flags sessionIsLive: true (per the contract);
        // the session body carries ongoing: false to end it.
        let body = try XCTUnwrap(MockURLProtocol.lastRequestBody)
        let object = try XCTUnwrap(try JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(object["sessionIsLive"] as? Bool, true)
        let nested = try XCTUnwrap(object["session"] as? [String: Any])
        XCTAssertEqual(nested["ongoing"] as? Bool, false)
    }

    func testDiscardSendsDeleteEnvelope() async throws {
        MockURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.absoluteString, "https://api-dev.kiroku.cz/v1/sessions/delete")
            XCTAssertEqual(request.httpMethod, "POST")
            return self.ok(request)
        }
        _ = try await makeAPI().discard(sessionId: "sess-1")
        let body = try XCTUnwrap(MockURLProtocol.lastRequestBody)
        let object = try XCTUnwrap(try JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(object["sessionId"] as? String, "sess-1")
        XCTAssertEqual(object["sessionIsLive"] as? Bool, true)
        XCTAssertNil(object["session"], "delete body carries no session")
    }

    func testProdUsesProdBaseURL() async throws {
        MockURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.absoluteString, "https://api.kiroku.cz/v1/sessions/update")
            return self.ok(request)
        }
        _ = try await makeAPI(environment: .prod).update(makeSession())
    }

    // MARK: - Error mapping

    func testHttp407MapsToTokenExpired() async {
        MockURLProtocol.handler = { request in
            (HTTPURLResponse(url: request.url!, statusCode: 407, httpVersion: nil, headerFields: nil)!, Data())
        }
        await assertThrows(try await makeAPI().update(makeSession()), .tokenExpired)
    }

    func testHttp401MapsToTokenRevoked() async {
        MockURLProtocol.handler = { request in
            (HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!, Data())
        }
        await assertThrows(try await makeAPI().update(makeSession()), .tokenRevoked)
    }

    func testJsonCode407InBodyMapsToTokenExpired() async {
        // Even with a 2xx HTTP status, a jsonCode of 407 in the body is honored.
        MockURLProtocol.handler = { request in
            self.ok(request, json: "{\"jsonCode\":407}")
        }
        await assertThrows(try await makeAPI().update(makeSession()), .tokenExpired)
    }

    func testServerErrorMapsToServer() async {
        MockURLProtocol.handler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!
            return (response, Data("{\"jsonCode\":500,\"message\":\"boom\"}".utf8))
        }
        do {
            _ = try await makeAPI().update(makeSession())
            XCTFail("expected a server error")
        } catch let KirokuAPIError.server(statusCode, jsonCode, message) {
            XCTAssertEqual(statusCode, 500)
            XCTAssertEqual(jsonCode, 500)
            XCTAssertEqual(message, "boom")
        } catch {
            XCTFail("unexpected error: \(error)")
        }
    }

    func testNetworkFailureMapsToNetwork() async {
        MockURLProtocol.handler = { _ in
            throw URLError(.notConnectedToInternet)
        }
        do {
            _ = try await makeAPI().update(makeSession())
            XCTFail("expected a network error")
        } catch let KirokuAPIError.network(message) {
            XCTAssertFalse(message.isEmpty)
        } catch {
            XCTFail("unexpected error: \(error)")
        }
    }

    func testMissingTokenThrowsAndMakesNoRequest() async {
        MockURLProtocol.handler = { request in
            XCTFail("no request should be made without a token")
            return self.ok(request)
        }
        let api = KirokuAPI(environment: .dev, urlSession: MockURLProtocol.makeSession(), tokenProvider: { nil })
        await assertThrows(try await api.update(makeSession()), .missingToken)
    }

    // MARK: - Helpers

    private func assertThrows(
        _ expression: @autoclosure () async throws -> KirokuAPIResponse,
        _ expected: KirokuAPIError,
        file: StaticString = #filePath,
        line: UInt = #line
    ) async {
        do {
            _ = try await expression()
            XCTFail("expected \(expected) to be thrown", file: file, line: line)
        } catch let error as KirokuAPIError {
            XCTAssertEqual(error, expected, file: file, line: line)
        } catch {
            XCTFail("unexpected error: \(error)", file: file, line: line)
        }
    }
}

/// The ops endpoint the watch uses for a Sessions v2 session (W2).
final class KirokuAPIOpsTests: XCTestCase {
    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
    }

    override func tearDown() {
        MockURLProtocol.reset()
        super.tearDown()
    }

    private func makeAPI() -> KirokuAPI {
        KirokuAPI(
            environment: .dev,
            token: "token-1",
            urlSession: MockURLProtocol.makeSession()
        )
    }

    private func ok(_ request: URLRequest) -> (HTTPURLResponse, Data) {
        // swiftlint:disable:next force_unwrapping
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 200,
            httpVersion: nil,
            headerFields: nil
        )!
        return (response, Data(#"{"jsonCode":200,"onyxData":[]}"#.utf8))
    }

    func testPostsToTheOpsEndpointWithTheOpIdAsTheIdempotencyKey() async throws {
        var seen: URLRequest?
        MockURLProtocol.handler = { request in
            seen = request
            return self.ok(request)
        }
        let op = SessionOp.addEntry(
            sessionId: "-S1",
            entryId: "-W1",
            entry: SessionEntry(
                ts: 1_700_000_000_000,
                key: "beer",
                count: 1,
                source: SessionEntry.watchSource,
                authorUid: "uid-A",
                targetUid: "uid-A",
                createdAt: 1_700_000_000_000
            ),
            opId: "op-abc",
            now: 1_700_000_000_000
        )

        _ = try await makeAPI().apply(op)

        XCTAssertEqual(seen?.url?.absoluteString, "https://api-dev.kiroku.cz/v1/sessions/ops")
        // The server requires the header to equal `opId`; that is what makes a
        // resend answer from its record instead of applying the drink twice.
        XCTAssertEqual(seen?.value(forHTTPHeaderField: "Idempotency-Key"), "op-abc")
        XCTAssertEqual(seen?.value(forHTTPHeaderField: "Authorization"), "Bearer token-1")
    }

    func testEncodesTheEnvelopeTheServerExpects() async throws {
        MockURLProtocol.handler = { request in self.ok(request) }
        let op = SessionOp.addEntry(
            sessionId: "-S1",
            entryId: "-W1",
            entry: SessionEntry(
                ts: 1_700_000_000_000,
                key: "wine",
                count: 2,
                volumeMl: 150,
                abv: 0.12,
                source: SessionEntry.watchSource,
                authorUid: "uid-A",
                targetUid: "uid-A",
                createdAt: 1_700_000_000_000
            ),
            opId: "op-abc",
            now: 1_700_000_000_123
        )

        _ = try await makeAPI().apply(op)

        let body = try XCTUnwrap(MockURLProtocol.lastRequestBody)
        let json = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: body) as? [String: Any]
        )
        XCTAssertEqual(json["opId"] as? String, "op-abc")
        XCTAssertEqual(json["sessionId"] as? String, "-S1")
        XCTAssertEqual(json["type"] as? String, "add_entry")
        XCTAssertEqual(json["client_ts"] as? Int, 1_700_000_000_123)

        let payload = try XCTUnwrap(json["payload"] as? [String: Any])
        XCTAssertEqual(payload["entryId"] as? String, "-W1")
        XCTAssertEqual(payload["key"] as? String, "wine")
        XCTAssertEqual(payload["count"] as? Int, 2)
        XCTAssertEqual(payload["volume_ml"] as? Double, 150)
        XCTAssertEqual(payload["abv"] as? Double, 0.12)
        XCTAssertEqual(payload["source"] as? String, "watch")
        // The server owns these; the watch must not claim them.
        XCTAssertNil(payload["author_uid"])
        XCTAssertNil(payload["created_at"])
        // Absent fields are dropped rather than sent as null, so the server's
        // "leave it alone" semantics apply.
        XCTAssertNil(payload["start_time"])
        XCTAssertNil(payload["end_time"])
    }

    func testAnEndOpCarriesOnlyItsEndTime() async throws {
        MockURLProtocol.handler = { request in self.ok(request) }
        _ = try await makeAPI().apply(
            SessionOp.end(
                sessionId: "-S1",
                endTime: 1_700_000_100_000,
                opId: "op-end",
                now: 1_700_000_100_000
            )
        )

        let body = try XCTUnwrap(MockURLProtocol.lastRequestBody)
        let json = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: body) as? [String: Any]
        )
        let payload = try XCTUnwrap(json["payload"] as? [String: Any])
        XCTAssertEqual(json["type"] as? String, "end")
        XCTAssertEqual(payload["end_time"] as? Int, 1_700_000_100_000)
        XCTAssertNil(payload["entryId"])
    }

    func testAStartOpCarriesTheSessionMeta() async throws {
        MockURLProtocol.handler = { request in self.ok(request) }
        let session = DrinkingSession.newLive(
            id: "-S1",
            now: 1_700_000_000_000,
            timezone: "Europe/Prague",
            schemaV2: true
        )
        _ = try await makeAPI().apply(SessionOp.start(session, opId: "op-start"))

        let body = try XCTUnwrap(MockURLProtocol.lastRequestBody)
        let json = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: body) as? [String: Any]
        )
        let payload = try XCTUnwrap(json["payload"] as? [String: Any])
        XCTAssertEqual(json["type"] as? String, "start")
        XCTAssertEqual(payload["start_time"] as? Int, 1_700_000_000_000)
        XCTAssertEqual(payload["timezone"] as? String, "Europe/Prague")
        XCTAssertEqual(payload["type"] as? String, "live")
        XCTAssertEqual(payload["visibility"] as? String, "friends")
    }

    // MARK: - Which failures the outbox may drop

    func testADeterministicRefusalIsRecognized() {
        // A payload the server actively refused: replaying it can never
        // succeed, so the outbox drops it rather than blocking every drink
        // behind it.
        for status in [400, 403, 404, 422, 460] {
            let error = KirokuAPIError.server(statusCode: status, jsonCode: status, message: nil)
            XCTAssertTrue(error.isDeterministicRefusal, "\(status) should be dropped")
        }
    }

    func testTransientFailuresAreNotRefusals() {
        // "Later", not "wrong": these keep the op queued.
        for status in [408, 425, 429, 500, 502, 504] {
            let error = KirokuAPIError.server(statusCode: status, jsonCode: nil, message: nil)
            XCTAssertFalse(error.isDeterministicRefusal, "\(status) should be retried")
        }
        XCTAssertFalse(KirokuAPIError.network(message: "offline").isDeterministicRefusal)
        XCTAssertFalse(KirokuAPIError.invalidResponse.isDeterministicRefusal)
        // Auth failures recover through the phone, not by dropping the drink.
        XCTAssertFalse(KirokuAPIError.tokenExpired.isDeterministicRefusal)
        XCTAssertFalse(KirokuAPIError.missingToken.isDeterministicRefusal)
    }
}
