import Foundation

/// The kiroku-api environment the watch talks to. Mirrors the dynamic root
/// selection in `src/CONFIG.ts`.
public enum KirokuEnvironment: Sendable {
    case dev
    case prod

    /// Base URL for this environment.
    public var baseURL: URL {
        switch self {
        case .dev:
            // swiftlint:disable:next force_unwrapping
            return URL(string: "https://api-dev.kiroku.cz")!
        case .prod:
            // swiftlint:disable:next force_unwrapping
            return URL(string: "https://api.kiroku.cz")!
        }
    }
}

/// A typed outcome of an API call. Mirrors the auth split documented in
/// `src/libs/HttpUtils.ts`: a `407` means the Firebase ID token is expired (the
/// app refreshes and replays), a `401` means it is revoked (the app forces
/// sign-out). On the watch, both surface as "open Kiroku on your phone to
/// reconnect"; the distinction is preserved for the credential bridge (Phase 3).
public enum KirokuAPIError: Error, Equatable, Sendable {
    /// No token was available to authorize the request.
    case missingToken
    /// HTTP/jsonCode `407` — the ID token is expired. Needs a refreshed token.
    case tokenExpired
    /// HTTP/jsonCode `401` — the token is revoked/invalid. Needs re-auth.
    case tokenRevoked
    /// Any other non-2xx response. Carries the HTTP status, any `jsonCode` from
    /// the body, and a best-effort server message.
    case server(statusCode: Int, jsonCode: Int?, message: String?)
    /// A transport-level failure (offline, timeout, DNS, TLS, …).
    case network(message: String)
    /// The response was not an HTTP response, or could not be interpreted.
    case invalidResponse
}

/// A successful (2xx) API response. Exposes the status, any decoded `jsonCode`,
/// and the raw body so callers aren't coupled to a rigid success schema (the
/// session endpoints' success payload is not needed by the MVP).
public struct KirokuAPIResponse: Sendable {
    public let statusCode: Int
    public let jsonCode: Int?
    public let body: Data

    /// The body decoded as a JSON object, if it is one.
    public var json: [String: Any]? {
        guard !body.isEmpty,
              let object = try? JSONSerialization.jsonObject(with: body),
              let dictionary = object as? [String: Any] else {
            return nil
        }
        return dictionary
    }
}

/// Pure-Swift (`URLSession`, no Firebase SDK) client for the two kiroku-api
/// session endpoints the watch needs. The token is supplied by a caller-provided
/// closure so Phase 3 can plug in the Keychain-cached, phone-bridged credential
/// without this layer knowing anything about WatchConnectivity.
///
/// Every request sends `Content-Type: application/json` and, when a token is
/// available, `Authorization: Bearer <idToken>` — exactly as `HttpUtils.ts` does.
public final class KirokuAPI: @unchecked Sendable {
    private let environment: KirokuEnvironment
    private let urlSession: URLSession
    private let tokenProvider: @Sendable () -> String?

    /// - Parameters:
    ///   - environment: dev or prod base URL.
    ///   - urlSession: injectable for tests; defaults to `.shared`.
    ///   - tokenProvider: returns the current Firebase ID token, or `nil` when
    ///     none is available (yields ``KirokuAPIError/missingToken``).
    public init(
        environment: KirokuEnvironment,
        urlSession: URLSession = .shared,
        tokenProvider: @escaping @Sendable () -> String?
    ) {
        self.environment = environment
        self.urlSession = urlSession
        self.tokenProvider = tokenProvider
    }

    /// Convenience initializer for a fixed token (e.g. the acceptance test's
    /// pasted dev token).
    public convenience init(
        environment: KirokuEnvironment,
        token: String,
        urlSession: URLSession = .shared
    ) {
        self.init(environment: environment, urlSession: urlSession, tokenProvider: { token })
    }

    // MARK: - Operations

    /// Start a live session. POSTs the whole session to `/v1/sessions/update`
    /// with `sessionIsLive: true`. (`start`, `update` and `save` share one wire
    /// contract — drinks are part of the session object; there is no per-drink
    /// endpoint. The name documents intent at the call site.)
    @discardableResult
    public func start(_ session: DrinkingSession) async throws -> KirokuAPIResponse {
        try await postSessionUpdate(session)
    }

    /// Push the current state of a live session (e.g. after +/− a unit). Same
    /// wire contract as ``start(_:)``.
    @discardableResult
    public func update(_ session: DrinkingSession) async throws -> KirokuAPIResponse {
        try await postSessionUpdate(session)
    }

    /// Save (finalize) a session. Same endpoint and envelope as ``start(_:)``;
    /// callers should pass a session with `ongoing == false` to end it.
    @discardableResult
    public func save(_ session: DrinkingSession) async throws -> KirokuAPIResponse {
        try await postSessionUpdate(session)
    }

    /// Discard a live session. POSTs to `/v1/sessions/delete` with
    /// `{ sessionId, sessionIsLive: true }`.
    @discardableResult
    public func discard(sessionId: String) async throws -> KirokuAPIResponse {
        let body = DeleteSessionRequest(sessionId: sessionId, sessionIsLive: true)
        return try await post(path: "/v1/sessions/delete", body: body)
    }

    // MARK: - Internals

    private func postSessionUpdate(_ session: DrinkingSession) async throws -> KirokuAPIResponse {
        let body = UpdateSessionRequest(sessionId: session.id, session: session, sessionIsLive: true)
        return try await post(path: "/v1/sessions/update", body: body)
    }

    private func post<Body: Encodable>(path: String, body: Body) async throws -> KirokuAPIResponse {
        guard let token = tokenProvider(), !token.isEmpty else {
            throw KirokuAPIError.missingToken
        }

        // Concatenate rather than `appendingPathComponent` so the path is exact
        // (`https://api-dev.kiroku.cz/v1/sessions/update`) with no slash surprises.
        guard let url = URL(string: environment.baseURL.absoluteString + path) else {
            throw KirokuAPIError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        // Envelope keys (`sessionId`, `sessionIsLive`) are camelCase on the wire;
        // the snake_case session fields carry their own CodingKeys, so the
        // encoder must use default key coding (no global snake_case strategy).
        request.httpBody = try JSONEncoder().encode(body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await urlSession.data(for: request)
        } catch {
            throw KirokuAPIError.network(message: error.localizedDescription)
        }

        guard let http = response as? HTTPURLResponse else {
            throw KirokuAPIError.invalidResponse
        }

        let jsonCode = Self.parseJSONCode(from: data)
        let status = http.statusCode

        // Auth split — match on HTTP status or a `jsonCode` carried in the body.
        if status == 407 || jsonCode == 407 {
            throw KirokuAPIError.tokenExpired
        }
        if status == 401 || jsonCode == 401 {
            throw KirokuAPIError.tokenRevoked
        }

        guard (200..<300).contains(status) else {
            throw KirokuAPIError.server(
                statusCode: status,
                jsonCode: jsonCode,
                message: Self.parseMessage(from: data)
            )
        }

        return KirokuAPIResponse(statusCode: status, jsonCode: jsonCode, body: data)
    }

    private static func parseJSONCode(from data: Data) -> Int? {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        if let code = object["jsonCode"] as? Int {
            return code
        }
        if let code = object["jsonCode"] as? String {
            return Int(code)
        }
        return nil
    }

    private static func parseMessage(from data: Data) -> String? {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        for key in ["message", "error", "errorMessage"] {
            if let message = object[key] as? String {
                return message
            }
        }
        return nil
    }
}

// MARK: - Request envelopes

/// `{ sessionId, session, sessionIsLive }` — the body of `/v1/sessions/update`.
private struct UpdateSessionRequest: Encodable {
    let sessionId: String
    let session: DrinkingSession
    let sessionIsLive: Bool
}

/// `{ sessionId, sessionIsLive }` — the body of `/v1/sessions/delete`.
private struct DeleteSessionRequest: Encodable {
    let sessionId: String
    let sessionIsLive: Bool
}
