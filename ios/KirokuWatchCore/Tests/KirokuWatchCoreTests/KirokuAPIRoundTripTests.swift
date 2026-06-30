import XCTest
@testable import KirokuWatchCore

/// The Phase 2 acceptance test: round-trip a real live session against the live
/// kiroku-api, mirroring the Phase 0 spike (`scripts/watch-spike/post-session.mjs`):
/// `POST /v1/sessions/update` (create) then `POST /v1/sessions/delete` (cleanup).
///
/// It hits the network, so it is **gated on a pasted Firebase ID token** and
/// skips cleanly when none is provided (CI, local runs without a token):
///
///   KIROKU_ID_TOKEN=<dev id token> swift test \
///       --package-path "ios/KirokuWatchCore" \
///       --filter KirokuAPIRoundTripTests
///
/// Optional env: `KIROKU_API_ENV=dev|prod` (default `dev`), `KIROKU_UNITS` (default 2).
/// Grab a dev token the same way the spike's README describes. Tokens last ~1h;
/// a 407/401 means it expired/was revoked — grab a fresh one.
final class KirokuAPIRoundTripTests: XCTestCase {
    func testCreateAndDeleteRoundTrip() async throws {
        guard let token = ProcessInfo.processInfo.environment["KIROKU_ID_TOKEN"], !token.isEmpty else {
            throw XCTSkip("Set KIROKU_ID_TOKEN to a dev Firebase ID token to run the live round-trip.")
        }

        let environment: KirokuEnvironment =
            ProcessInfo.processInfo.environment["KIROKU_API_ENV"] == "prod" ? .prod : .dev
        let units = ProcessInfo.processInfo.environment["KIROKU_UNITS"].flatMap(Int.init) ?? 2

        let api = KirokuAPI(environment: environment, token: token)

        let sessionId = PushID.generate()
        var session = DrinkingSession.newLive(id: sessionId, timezone: "Europe/Prague")
        if units > 0 {
            session.addDrinks(units, of: .beer)
        }

        // Create.
        do {
            let response = try await api.start(session)
            XCTAssertTrue((200..<300).contains(response.statusCode), "create status \(response.statusCode)")
        } catch KirokuAPIError.tokenExpired {
            throw XCTSkip("Token expired (407) — grab a fresh dev ID token.")
        } catch KirokuAPIError.tokenRevoked {
            throw XCTSkip("Token revoked (401) — grab a fresh dev ID token.")
        }

        // Cleanup — delete the session we just created.
        let deleteResponse = try await api.discard(sessionId: sessionId)
        XCTAssertTrue((200..<300).contains(deleteResponse.statusCode), "delete status \(deleteResponse.statusCode)")
    }
}
