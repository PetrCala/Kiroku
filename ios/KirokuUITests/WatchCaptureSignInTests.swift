import XCTest

// Signs the phone app in so the PAIRED Apple Watch simulator can be
// screenshotted in its signed-in state. Runs only inside the `watch` job of
// .github/workflows/screenshots.yml; the KIROKU_WATCH_CAPTURE guard skips it
// everywhere else, including every fastlane `snapshot` run of the phone
// matrix (snapshot runs the whole KirokuUITests target and must not pay for
// this flow once per device/language pair).
//
// Why this exists: the watch app is an independent API client that receives
// its Firebase credential from the phone over WatchConnectivity
// (ios/kiroku/WatchBridge.swift pushes on login, token refresh, foreground,
// and ongoing-session change; ios/Kiroku Watch App/Connectivity receives). An
// unpaired or signed-out watch simulator only ever shows the reconnect
// screen, so the phone must sign in first, and the watch app must already be
// installed on the paired watch simulator when this test runs (the push is
// gated on WCSession.isWatchAppInstalled).
//
// Unlike ScreenshotTests, a sign-in failure here FAILS the test: the whole
// job exists to produce one screenshot, and a not-signed-in watch capture is
// worthless, so failing loudly at the earliest step gives the clearest log.
// Opening a live session afterwards is best-effort only: with an ongoing
// session mirrored, the watch shows the unit counter (the better marketing
// shot); without one it shows the signed-in start screen, which is still a
// valid capture. The selectors mirror ScreenshotTests.swift on purpose; that
// file is the battle-tested source of truth for this app's accessibility
// tree. (Its helpers are private, hence the small duplication.)
final class WatchCaptureSignInTests: XCTestCase {
    private let app = XCUIApplication()

    @MainActor
    func testSignInAndOpenLiveSession() throws {
        guard ProcessInfo.processInfo.environment["KIROKU_WATCH_CAPTURE"] == "1" else {
            throw XCTSkip("KIROKU_WATCH_CAPTURE != 1; only the watch capture job runs this")
        }
        continueAfterFailure = false
        app.launch()

        signIn()

        // Best-effort: an ongoing session makes the watch open on the unit
        // counter instead of the idle start screen. The demo account may
        // already have one (this test ran before, or the phone matrix job
        // started one), in which case the FAB flow may not reach the Live
        // screen; either way a session snapshot reaches the watch.
        if !openLiveSession() {
            NSLog("[watch-capture] live session not opened; the watch will show the signed-in start screen")
        }

        // Let the throttled (2 s) WatchConnectivity push leave the phone
        // before xcodebuild tears the app down.
        Thread.sleep(forTimeInterval: 10)
    }

    // MARK: - Steps (selectors mirror ScreenshotTests.swift)

    private func signIn() {
        // A fresh install lands on `Initial Screen` (marketing screen with a
        // "Log in" role="link" pressable); a reinstalled-but-cached state can
        // land straight on `Auth Screen`.
        if !screen("Auth Screen", timeout: 5) {
            guard screen("Initial Screen", timeout: 45) else {
                XCTFail("[watch-capture] neither Initial Screen nor Auth Screen appeared after launch")
                return
            }
            guard tapElement(labeled: ["Log in", "Přihlaste se zde"], timeout: 20) else {
                XCTFail("[watch-capture] log-in link not found on Initial Screen")
                return
            }
            guard screen("Auth Screen", timeout: 20) else {
                XCTFail("[watch-capture] Auth Screen never appeared after tapping the log-in link")
                return
            }
        }

        let emailField = app.textFields.firstMatch
        guard emailField.waitForExistence(timeout: 10) else {
            XCTFail("[watch-capture] email field not found on Auth Screen")
            return
        }
        emailField.tap()
        emailField.typeText(ProcessInfo.processInfo.environment["APPLE_DEMO_EMAIL"] ?? "")

        let passwordField = app.secureTextFields.firstMatch
        guard passwordField.waitForExistence(timeout: 5) else {
            XCTFail("[watch-capture] password field not found on Auth Screen")
            return
        }
        passwordField.tap()
        passwordField.typeText(ProcessInfo.processInfo.environment["APPLE_DEMO_PASSWORD"] ?? "")

        guard tapElement(labeled: ["Log in", "Přihlásit se"], timeout: 10) else {
            XCTFail("[watch-capture] submit button not found on Auth Screen")
            return
        }
        guard screen("Home Screen", timeout: 60) else {
            XCTFail("[watch-capture] Home Screen never appeared after submitting credentials")
            return
        }
        NSLog("[watch-capture] signed in")
    }

    @discardableResult
    private func openLiveSession() -> Bool {
        guard tapElement(labeled: ["Home", "Domů"]), screen("Home Screen") else {
            return false
        }
        guard tapElement(labeled: [
            "Start a session (Floating action)",
            "Spustit relaci (plovoucí tlačítko)",
        ]) else {
            return false
        }
        guard tapElement(labeled: ["Live", "Živá"]) else {
            return false
        }
        guard screen("Live Session Screen", timeout: 25) else {
            return false
        }
        NSLog("[watch-capture] live session open")
        return true
    }

    // MARK: - Element lookup (same rationale as ScreenshotTests.swift)

    private func element(labeled labels: [String], timeout: TimeInterval = 10) -> XCUIElement? {
        let exact = NSPredicate(format: "label IN %@", labels)
        let match = app.descendants(matching: .any).matching(exact).firstMatch
        if match.waitForExistence(timeout: timeout) {
            return match
        }
        let loose = NSCompoundPredicate(
            orPredicateWithSubpredicates: labels.map {
                NSPredicate(format: "label CONTAINS[c] %@", $0)
            }
        )
        let fallback = app.descendants(matching: .any).matching(loose).firstMatch
        return fallback.waitForExistence(timeout: 3) ? fallback : nil
    }

    private func screen(_ identifier: String, timeout: TimeInterval = 15) -> Bool {
        app.otherElements[identifier].waitForExistence(timeout: timeout)
    }

    private func tap(_ element: XCUIElement) {
        if element.isHittable {
            element.tap()
            return
        }
        element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    @discardableResult
    private func tapElement(labeled labels: [String], timeout: TimeInterval = 10) -> Bool {
        guard let match = element(labeled: labels, timeout: timeout) else {
            return false
        }
        tap(match)
        return true
    }
}
