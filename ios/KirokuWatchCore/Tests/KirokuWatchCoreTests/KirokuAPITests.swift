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
