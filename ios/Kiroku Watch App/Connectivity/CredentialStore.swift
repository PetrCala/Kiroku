//
//  CredentialStore.swift
//  Kiroku Watch App
//
//  Keychain-backed cache for the phone-bridged Firebase credential (Phase 3 of
//  docs/apple-watch-mvp.md). The phone pushes {idToken, uid, expiresAt, apiEnv}
//  over WatchConnectivity; the watch persists it here so a cold-started watch
//  app can call kiroku-api without waiting for a fresh delivery. The token is
//  used until `expiresAt`; iOS will not run the phone's RN JS bridge in the
//  background, so no refresh can happen until the phone app is next alive.
//

import Foundation
import Security

/// The credential the phone hands over. All timestamps are epoch milliseconds,
/// matching the wire contract in `ios/kiroku/WatchBridge.swift`.
struct StoredCredential: Codable, Equatable {
    /// The Firebase ID token to send as `Authorization: Bearer <idToken>`.
    let idToken: String

    /// The Firebase uid the token belongs to.
    let uid: String

    /// Epoch-millisecond expiry of `idToken` (Firebase ID tokens live ~1h).
    let expiresAt: Double

    /// Which kiroku-api backend the phone build talks to: "dev" or "prod".
    let apiEnv: String

    /// Treat the token as stale this long before actual expiry so a request
    /// never carries a token that dies in flight.
    static let stalenessMarginMs: Double = 60_000

    /// Whether the token is expired (or about to expire) at `nowMs`.
    func isStale(nowMs: Double) -> Bool {
        nowMs >= expiresAt - Self.stalenessMarginMs
    }

    /// Whether the token is expired (or about to expire) right now.
    var isStale: Bool {
        isStale(nowMs: Date().timeIntervalSince1970 * 1000)
    }

    /// The `KirokuAPI` environment matching the phone's backend selection.
    /// Defaults to prod for unknown values; a prod token is rejected by the dev
    /// API (and vice versa), so guessing wrong fails loudly rather than writing
    /// into the wrong backend.
    var environment: KirokuEnvironment {
        apiEnv == "dev" ? .dev : .prod
    }
}

/// Minimal Keychain wrapper for the single credential item. Generic-password
/// class, readable after first unlock so background WCSession deliveries can
/// persist it while the watch is on the wrist.
enum CredentialStore {
    private static let service = "cz.kiroku.watch.credential"
    private static let account = "firebase-id-token"

    private static var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    /// Persist the credential, replacing any previous one.
    static func save(_ credential: StoredCredential) {
        guard let data = try? JSONEncoder().encode(credential) else {
            return
        }
        SecItemDelete(baseQuery as CFDictionary)
        var attributes = baseQuery
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(attributes as CFDictionary, nil)
    }

    /// The last persisted credential, if any (stale or not; callers decide).
    static func load() -> StoredCredential? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else {
            return nil
        }
        return try? JSONDecoder().decode(StoredCredential.self, from: data)
    }

    /// Remove the persisted credential (sign-out on the phone).
    static func clear() {
        SecItemDelete(baseQuery as CFDictionary)
    }

    /// The `KirokuAPI.tokenProvider` seam: the cached token, or nil when absent
    /// or stale (which surfaces as `KirokuAPIError.missingToken`).
    static func validToken() -> String? {
        guard let credential = load(), !credential.isStale else {
            return nil
        }
        return credential.idToken
    }
}
