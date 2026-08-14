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
        // land straight on `Auth Screen`. The long timeout is for a cold
        // ReleaseProduction boot on a busy CI simulator, which can sit on the
        // boot splash for well over a minute before the first screen mounts.
        if !screen("Auth Screen", timeout: 5) {
            guard screen("Initial Screen", timeout: 120) else {
                dumpHierarchy("first screen")
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

        // One free dump of the signed-out form, so a broken selector is
        // diagnosable from the first failed run instead of costing another
        // ~70 minute round trip. The whole job is manual dispatch only.
        dumpHierarchy("auth screen")

        guard fillField(
            typed: app.textFields,
            labels: ["Email", "E-mail"],
            with: credential("APPLE_DEMO_EMAIL"),
            named: "email"
        ) else {
            return
        }

        guard fillField(
            typed: app.secureTextFields,
            labels: ["Password", "Heslo"],
            with: credential("APPLE_DEMO_PASSWORD"),
            named: "password"
        ) else {
            return
        }

        // The submit button sits directly below the password field, so the
        // keyboard covers it. XCUITest still finds it and reports it as not
        // hittable, and a coordinate tap at its centre lands on a keyboard
        // key instead: the form is never submitted and the failure surfaces
        // 60 seconds later as a missing Home Screen.
        dismissKeyboard()

        guard tapElement(labeled: ["Log in", "Přihlásit se"], timeout: 10) else {
            dumpHierarchy("submit missing")
            XCTFail("[watch-capture] submit button not found on Auth Screen")
            return
        }
        guard screen("Home Screen", timeout: 60) else {
            dumpHierarchy("post submit")
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
            dumpHierarchy("fab missing")
            return false
        }
        guard tapElement(labeled: ["Live", "Živá"]) else {
            // The menu the button opens is what failed, not the button, so
            // dump what is actually on screen. Best effort step, so this
            // stays a log rather than a failure.
            dumpHierarchy("fab menu")
            return false
        }
        guard screen("Live Session Screen", timeout: 25) else {
            dumpHierarchy("after live tap")
            return false
        }
        NSLog("[watch-capture] live session open")
        return true
    }

    // MARK: - Element lookup (same rationale as ScreenshotTests.swift)

    /// Types `text` into a form field, preferring the native element type
    /// (`textFields` / `secureTextFields`) and falling back to the field's
    /// accessibility label.
    ///
    /// The fallback exists because this app's `TextInput` wraps the native
    /// field in a labelled container. When that container is itself an
    /// accessibility element it collapses its children, so the inner field
    /// never appears in `app.textFields` and only the container's label is
    /// matchable. Tapping the container still focuses the field underneath,
    /// so the text is typed at the app level, into whatever holds focus.
    private func fillField(
        typed: XCUIElementQuery,
        labels: [String],
        with text: String,
        named name: String
    ) -> Bool {
        let native = typed.firstMatch
        if native.waitForExistence(timeout: 10) {
            tap(native)
            typeSlowly(text, into: native)
            verify(native, holds: text, named: name)
            return true
        }

        guard let container = element(labeled: labels, timeout: 5) else {
            dumpHierarchy("\(name) field missing")
            XCTFail("[watch-capture] \(name) field not found on Auth Screen")
            return false
        }

        NSLog("[watch-capture] %@ field matched by label, not element type", name)
        tap(container)
        typeSlowly(text, into: app)
        return true
    }

    /// Reads a credential from the environment, trimming surrounding
    /// whitespace: a repository secret pasted with a trailing newline would
    /// otherwise be typed literally and rejected as a wrong password.
    ///
    /// Logs lengths only, never any part of the value, so an empty or
    /// whitespace-padded secret is diagnosable from the run log without
    /// putting the credential in it.
    private func credential(_ name: String) -> String {
        let raw = ProcessInfo.processInfo.environment[name] ?? ""
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.count != trimmed.count {
            NSLog(
                "[watch-capture] %@ had %d characters of surrounding whitespace, trimmed",
                name,
                raw.count - trimmed.count
            )
        }
        if trimmed.isEmpty {
            NSLog("[watch-capture] %@ is empty; the secret is missing from this run", name)
        }
        return trimmed
    }

    /// Types one character at a time.
    ///
    /// `typeText` delivers the whole string as fast as the keyboard accepts
    /// it, which outruns this app's controlled `TextInput`: React re-renders
    /// the field from a state value that is still several keystrokes behind,
    /// and every keystroke that lands mid-render is discarded. A 17 character
    /// address arrived as "T.cz", which the form then rejected as invalid.
    /// Pacing the keystrokes lets each `onChangeText` round trip finish.
    private func typeSlowly(_ text: String, into element: XCUIElement) {
        for character in text {
            element.typeText(String(character))
            usleep(80_000)
        }
    }

    /// Logs when a field did not keep everything typed into it. Advisory
    /// only: the submit attempt and its error message are more diagnostic
    /// than a failure here, and `value` is redacted on secure fields.
    private func verify(_ field: XCUIElement, holds text: String, named name: String) {
        guard let actual = field.value as? String, actual != text else {
            return
        }
        NSLog(
            "[watch-capture] %@ field holds %d of %d characters after typing",
            name,
            actual.count,
            text.count
        )
    }

    /// Blurs the focused field so the keyboard stops covering the lower half
    /// of the form. Taps well above the inputs, where the screen holds only
    /// the logo, so nothing else is activated on the way.
    private func dismissKeyboard() {
        guard app.keyboards.element.exists else {
            return
        }
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.12)).tap()
        if !app.keyboards.element.waitForNonExistence(timeout: 5) {
            NSLog("[watch-capture] keyboard still up after tapping away from the form")
        }
    }

    /// Logs the accessibility tree in slices.
    ///
    /// `NSLog` truncates a single message at roughly a kilobyte, which is a
    /// dozen lines of hierarchy: enough to look like an empty screen and send
    /// the next iteration chasing the wrong bug. Slicing keeps the whole tree.
    private func dumpHierarchy(_ context: String) {
        let text = app.debugDescription
        let sliceLength = 800
        var start = text.startIndex
        var index = 0
        while start < text.endIndex {
            let end = text.index(start, offsetBy: sliceLength, limitedBy: text.endIndex) ?? text.endIndex
            NSLog("[watch-capture] %@ hierarchy [%d]: %@", context, index, String(text[start..<end]))
            start = end
            index += 1
        }
    }

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
        // A coordinate tap goes through whatever is on top at that point, so
        // it can silently hit the wrong thing. Worth a log line: it is the
        // difference between "the button did nothing" and "the tap never
        // reached the button".
        NSLog("[watch-capture] tapping %@ by coordinate, it is not hittable", element.label)
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
