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
        let auth = app.otherElements["AuthScreen"]
        XCTAssertTrue(auth.waitForExistence(timeout: 30), "AuthScreen never appeared")

        // Inputs lack testIDs — match by their containing TextField/SecureTextField.
        // The first text field in the form is email, then password (secure).
        let emailField = app.textFields.firstMatch
        emailField.tap()
        emailField.typeText(ProcessInfo.processInfo.environment["APPLE_DEMO_EMAIL"] ?? "")

        let passwordField = app.secureTextFields.firstMatch
        passwordField.tap()
        passwordField.typeText(ProcessInfo.processInfo.environment["APPLE_DEMO_PASSWORD"] ?? "")

        // Submit button has no testID — matched by its localized title.
        // Update these strings if the labels change in src/languages/{en,cs_cz}.ts.
        let submit = app.buttons.matching(NSPredicate(format:
            "label IN { 'Log In', 'Přihlásit se', 'Sign In' }"
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
