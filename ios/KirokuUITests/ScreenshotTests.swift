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

        if ProcessInfo.processInfo.environment["KIROKU_DUMP_A11Y"] == "1" {
            dumpAccessibilityTrees()
        }

        returnToHome()

        snapshot("01_Home")

        openStartSession()
        snapshot("02_LiveSession")

        openCalendarDay()
        snapshot("03_DayOverview")

        openStatisticsTab(matching: ["Overview", "Přehled"])
        snapshot("04_Statistics")

        openStatisticsTab(matching: ["Trends", "Trendy"])
        snapshot("05_AlcoholFree")

        openFriends()
        snapshot("06_Friends")

        openSettings()
        snapshot("07_Settings")
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

    // MARK: - Selector discovery

    /// Walks every bottom tab and logs the full element tree for each.
    ///
    /// Selector work against this app is otherwise a 30 to 45 minute CI round
    /// trip per guess, because there is no way to see what a screen actually
    /// exposes without building and launching it. One run of this prints ground
    /// truth for every screen at once, so selectors can be written from real
    /// identifiers instead of inference.
    ///
    /// Deliberately never asserts: a screen that fails to open logs the miss and
    /// the walk continues, so one bad tab cannot abort the run before the other
    /// trees are collected. Opt in with KIROKU_DUMP_A11Y=1 so normal capture runs
    /// stay quiet.
    private func dumpAccessibilityTrees() {
        let tabs = [
            ["Home", "Domů"],
            ["Friends", "Přátelé"],
            ["Statistics", "Statistiky"],
            ["Settings", "Nastavení"],
        ]
        for labels in tabs {
            let predicate = NSPredicate(format: "label IN %@", labels)
            let button = app.buttons.matching(predicate).firstMatch
            guard button.waitForExistence(timeout: 8) else {
                NSLog("[a11y-dump] TAB NOT FOUND: \(labels)")
                continue
            }
            button.tap()
            Thread.sleep(forTimeInterval: 3)
            NSLog("[a11y-dump] ===== BEGIN \(labels) =====")
            NSLog("%@", app.debugDescription)
            NSLog("[a11y-dump] ===== END \(labels) =====")
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

    /// The calendar lives on Home, not on the Statistics tab. Tapping the wrong
    /// tab used to leave whatever screen was already showing on-screen, and the
    /// snapshot silently captured that instead of the Day Overview, which is how
    /// three of the six shipped screenshots ended up being Statistics screens.
    /// Every step here asserts, so a mis-tap fails the run instead of publishing
    /// the wrong screen.
    private func openCalendarDay() {
        returnToHome()
        let day = app.buttons.matching(identifier: "DayMarking").firstMatch
        XCTAssertTrue(
            day.waitForExistence(timeout: 15),
            "No DayMarking cell on Home. The demo account needs a logged session in the current month."
        )
        day.tap()
        XCTAssertTrue(
            app.otherElements["Day Overview Screen"].waitForExistence(timeout: 10),
            "Day Overview Screen never appeared after tapping a calendar day"
        )
    }

    /// Statistics is a bottom tab whose body is a set of inner tabs
    /// (Overview / Trends / Patterns / Breakdown). `labels` names the inner one.
    private func openStatisticsTab(matching labels: [String]) {
        tapTabBarButton(matching: ["Statistics", "Statistiky"])
        XCTAssertTrue(
            app.otherElements["Statistics Screen"].waitForExistence(timeout: 15),
            "Statistics Screen never appeared"
        )
        let predicate = NSPredicate(format: "label IN %@", labels)
        let tab = app.buttons.matching(predicate).firstMatch
        XCTAssertTrue(
            tab.waitForExistence(timeout: 10),
            "Statistics inner tab \(labels) not found"
        )
        tab.tap()
    }

    private func openFriends() {
        tapTabBarButton(matching: ["Friends", "Přátelé"])
        XCTAssertTrue(
            app.otherElements["SocialScreen"].waitForExistence(timeout: 15),
            "SocialScreen never appeared"
        )
    }

    private func openSettings() {
        tapTabBarButton(matching: ["Settings", "Nastavení"])
        _ = app.otherElements["SettingsScreen"].waitForExistence(timeout: 5)
    }

    private func tapTabBarButton(matching labels: [String]) {
        let predicate = NSPredicate(format: "label IN %@", labels)
        let button = app.buttons.matching(predicate).firstMatch
        XCTAssertTrue(
            button.waitForExistence(timeout: 10),
            "Bottom tab \(labels) not found"
        )
        button.tap()
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
