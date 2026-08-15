//
//  KirokuApp.swift
//  Kiroku Watch App
//
//  Created by PetrCala on 29.06.2024.
//
// KirokuWatchCore is compiled into this target rather than linked as a
// module, so its types are already in scope with no import.
import SwiftUI

@main
struct KirokuApp: App {
    init() {
        // Touch the singleton at launch so WCSession starts activating (and the
        // last phone-delivered credential/session is restored) before any view
        // model action needs it.
        _ = SessionConnectivity.shared

        // No-op unless launched with -KirokuScreenshotMode, which only the
        // App Store capture job passes.
        ScreenshotMode.seed()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

/// Seeds the watch with a signed-in live session for App Store screenshots.
///
/// Why this exists: the watch normally receives its credential from the phone
/// over WatchConnectivity, and that handoff does not work on a simulator pair.
/// The pair reports `isWatchAppInstalled == false` regardless of what is
/// actually installed, and WatchConnectivity enforces it, so every
/// `updateApplicationContext` is rejected with "Watch app is not installed"
/// and the watch can only ever render its reconnect screen. That is useless as
/// a store screenshot. See the watch job in .github/workflows/screenshots.yml.
///
/// Rather than fight the pairing daemon, the capture launches the watch app
/// with `-KirokuScreenshotMode` and this feeds the same payload the phone
/// would have sent, through the same entry point (`SessionConnectivity.apply`).
/// No network, no real credential, no WatchConnectivity: the screen renders
/// from local state.
///
/// A launch argument cannot be reached in a shipped build, and the seeded token
/// is a placeholder no backend would accept, so the capture stays offline by
/// construction.
///
/// Lives here rather than in its own file because the watch target lists its
/// sources explicitly in project.pbxproj; a new file would mean editing that,
/// and this is small enough not to be worth the churn.
enum ScreenshotMode {
    /// Launch argument the capture job passes to `simctl launch`.
    static let flag = "-KirokuScreenshotMode"

    static var isEnabled: Bool {
        ProcessInfo.processInfo.arguments.contains(flag)
    }

    /// Drinks shown on the counter. Enough to look like a real evening out
    /// without implying anything a reviewer would object to.
    private static let seededDrinks = 3

    static func seed(into connectivity: SessionConnectivity = .shared) {
        guard isEnabled else {
            return
        }

        let nowMs = Date().timeIntervalSince1970 * 1000
        let startedMs = nowMs - 90 * 60 * 1000

        let session = DrinkingSession(
            id: "screenshot-session",
            startTime: Int(startedMs),
            endTime: Int(nowMs),
            timezone: TimeZone.current.identifier,
            type: .live,
            ongoing: true,
            drinks: [String(Int(startedMs)): [DrinkKey.beer.rawValue: seededDrinks]]
        )

        guard let sessionData = try? JSONEncoder().encode(session),
              let sessionJSON = String(data: sessionData, encoding: .utf8) else {
            NSLog("[ScreenshotMode] could not encode the seeded session")
            return
        }

        connectivity.apply([
            "signedIn": true,
            "idToken": "screenshot-mode-placeholder-token",
            "uid": "screenshot-mode-user",
            // An hour out, so the credential never reads as stale mid-capture.
            "expiresAt": NSNumber(value: nowMs + 60 * 60 * 1000),
            "apiEnv": "prod",
            "ongoingSession": sessionJSON,
        ])
        NSLog("[ScreenshotMode] seeded a live session with %d drinks", seededDrinks)
    }
}
