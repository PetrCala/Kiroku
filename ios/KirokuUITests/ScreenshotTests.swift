import XCTest

// Captures App Store screenshots for the device + locale matrix declared in
// fastlane/Snapfile. fastlane invokes this once per (device, language) pair.
//
// IMPORTANT — manual setup required before this file compiles. See SCREENSHOTS.md:
//   1. Add a "UI Testing Bundle" target named `KirokuUITests` in Xcode.
//   2. Run `bundle exec fastlane snapshot init` from the repo root to drop
//      `SnapshotHelper.swift` next to this file; add it to the test target.
//   3. Set `APPLE_DEMO_EMAIL` / `APPLE_DEMO_PASSWORD` in the shell before
//      invoking the lane.
@MainActor
final class ScreenshotTests: XCTestCase {
    private let app = XCUIApplication()

    override func setUpWithError() throws {
        continueAfterFailure = false
        setupSnapshot(app)
        app.launch()
    }

    func testCaptureAppStoreScreenshots() throws {
        logIn()
        switchLocaleIfNeeded()
        returnToHome()

        snapshot("01_Home")

        openStartSession()
        snapshot("02_LiveSession")

        // Day overview is reached by tapping a past day in the calendar/history.
        // The exact navigation depends on which screen surfaces the calendar —
        // adjust if the social/statistics tab doesn't surface it directly.
        openCalendarDay()
        snapshot("03_DayOverview")

        openProfile()
        snapshot("04_Profile")

        openSettings()
        snapshot("05_Settings")
    }

    // MARK: - Login

    private func logIn() {
        // After the splash dismisses, the user lands on the Initial Screen
        // (src/screens/SignUp/InitialScreen.tsx). The screen container's
        // `testID` doesn't reliably surface as an XCUI accessibility element
        // — RN only exposes a View as an element when it has accessibility
        // properties (`accessible={true}`/label/role), and InitialScreen's
        // outer View has only `testID`. So we use the unique "Log in" link
        // (PressableWithFeedback with role=link, accessibilityLabel =
        // translate('common.logInHere')) as our presence indicator. Tapping
        // it routes to AuthScreen in sign-in mode — which is what we want
        // since the demo user already exists.
        let logInLink = app.buttons.matching(NSPredicate(format:
            "label IN { 'Log in', 'Přihlaste se zde' }"
        )).firstMatch
        if !logInLink.waitForExistence(timeout: 30) {
            // DIAGNOSTIC: dump the full accessibility tree so we can see the
            // real element identifiers / labels / types that the simulator
            // exposes. XCUITest only writes the hierarchy into the .xcresult
            // bundle (which CI doesn't upload), so print it into stdout where
            // the snapshot log captures it. Remove once selectors are stable.
            print("=== KIROKU A11Y TREE (Log in link not found) ===")
            print(app.debugDescription)
            print("=== END KIROKU A11Y TREE ===")
            XCTFail("Log in link on Initial Screen never appeared")
            return
        }
        logInLink.tap()

        // AuthScreen's outer View also only has `testID` (no accessible=true),
        // so the screen container isn't a discoverable XCUI element. Use the
        // email text field as the presence indicator — it's a real TextInput
        // and always exposed under app.textFields.
        let emailField = app.textFields.firstMatch
        XCTAssertTrue(emailField.waitForExistence(timeout: 30), "AuthScreen email field never appeared")

        // Inputs lack testIDs — match by their containing TextField/SecureTextField.
        // The first text field in the form is email, then password (secure).
        emailField.tap()
        emailField.typeText(ProcessInfo.processInfo.environment["APPLE_DEMO_EMAIL"] ?? "")

        let passwordField = app.secureTextFields.firstMatch
        passwordField.tap()
        passwordField.typeText(ProcessInfo.processInfo.environment["APPLE_DEMO_PASSWORD"] ?? "")

        // Submit button has no testID — matched by its localized title.
        // Labels follow common.logIn / common.signIn in src/languages/{en,cs_cz}.ts
        // (lowercase 'i' — the en label is "Log in", not "Log In").
        let submit = app.buttons.matching(NSPredicate(format:
            "label IN { 'Log in', 'Přihlásit se', 'Sign in' }"
        )).firstMatch
        submit.tap()

        let home = app.otherElements["Home Screen"]
        XCTAssertTrue(home.waitForExistence(timeout: 30), "Home Screen never appeared after login")
    }

    // MARK: - Locale handling

    /// Kiroku stores locale in Onyx, not OS-level. So even though fastlane sets
    /// AppleLanguages, the app ignores it — we navigate Settings → Language and
    /// pick the right option manually based on what fastlane asked for.
    private func switchLocaleIfNeeded() {
        let target = currentSnapshotLanguageInAppCode()
        guard target != "en" else { return }  // app default

        openSettings()

        // Settings → Preferences → Language. Match on localized titles or testIDs
        // if you add them later. For now, fall back to a row containing the word
        // "Language" / "Jazyk".
        tapMenuRow(matching: ["Language", "Jazyk"])
        tapMenuRow(matching: ["Preferences", "Předvolby"])
        tapMenuRow(matching: localeRowTitles(for: target))
    }

    private func currentSnapshotLanguageInAppCode() -> String {
        // fastlane's SnapshotHelper sets `-AppleLanguages (lang)` in launchArguments.
        let args = app.launchArguments
        if args.contains(where: { $0.contains("cs") }) { return "cs_cz" }
        return "en"
    }

    private func localeRowTitles(for code: String) -> [String] {
        switch code {
        case "cs_cz": return ["Čeština", "Czech"]
        default:      return ["English", "Angličtina"]
        }
    }

    // MARK: - Navigation helpers
    // The bottom tab bar buttons have accessibility labels matching the
    // translated bottomTabBar.* strings in src/languages/. No testIDs yet.

    private func returnToHome() {
        // The "Start Session" central tab button reveals the home flow.
        tapTabBarButton(matching: ["Start", "Začít", "Home", "Domů"])
    }

    private func openStartSession() {
        tapTabBarButton(matching: ["Start", "Začít"])
        let live = app.otherElements["Live Session Screen"]
        if !live.waitForExistence(timeout: 5) {
            // Tap the start-session popover's confirm button if it appeared.
            app.buttons.matching(NSPredicate(format:
                "label IN { 'Start Session', 'Spustit session', 'Begin' }"
            )).firstMatch.tap()
        }
        _ = live.waitForExistence(timeout: 10)
    }

    private func openCalendarDay() {
        tapTabBarButton(matching: ["Statistics", "Statistiky", "Calendar", "Kalendář"])
        // Tap the first day cell that has a recorded session.
        app.buttons.matching(identifier: "DayMarking").firstMatch.tap()
        _ = app.otherElements["Day Overview Screen"].waitForExistence(timeout: 5)
    }

    private func openProfile() {
        // Profile is typically reached from Home or Settings → Profile.
        openSettings()
        tapMenuRow(matching: ["Profile", "Profil"])
        _ = app.otherElements["Profile Screen"].waitForExistence(timeout: 5)
    }

    private func openSettings() {
        tapTabBarButton(matching: ["Settings", "Nastavení"])
        _ = app.otherElements["SettingsScreen"].waitForExistence(timeout: 5)
    }

    private func tapTabBarButton(matching labels: [String]) {
        let predicate = NSPredicate(format: "label IN %@", labels)
        let button = app.buttons.matching(predicate).firstMatch
        if button.waitForExistence(timeout: 5) {
            button.tap()
        }
    }

    private func tapMenuRow(matching labels: [String]) {
        let predicate = NSPredicate(format: "label IN %@", labels)
        let cell = app.cells.matching(predicate).firstMatch
        if cell.waitForExistence(timeout: 5) {
            cell.tap()
            return
        }
        // Some rows are rendered as buttons rather than cells in RN.
        app.buttons.matching(predicate).firstMatch.tap()
    }
}
