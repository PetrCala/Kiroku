import XCTest

// Captures App Store screenshots for the device + locale matrix declared in
// fastlane/Snapfile. fastlane invokes this once per (device, language) pair.
//
// The `KirokuUITests` target does not live in the committed project file; it is
// generated at run time by scripts/setup-screenshots-test-target.rb, which also
// copies fastlane's own SnapshotHelper.swift in next to this file. Run the lane
// (`bundle exec fastlane ios screenshots`) rather than building the target by
// hand, and export APPLE_DEMO_EMAIL / APPLE_DEMO_PASSWORD (for the lane's
// preflight check) plus TEST_RUNNER_-prefixed copies of every variable this
// file reads via ProcessInfo: xcodebuild forwards only TEST_RUNNER_<VAR> into
// the test runner process, with the prefix stripped.
//
// ─── Failure policy ──────────────────────────────────────────────────────────
// Every navigation step is guarded and records a `[capture-miss]` instead of
// asserting. Two reasons:
//
//   1. A missed step must never publish the WRONG screen. The 2026-07 set had
//      three shots that were really Statistics screens under other filenames,
//      because the old helpers tapped optimistically and `snapshot()` captured
//      whatever happened to still be on screen. Here a step that cannot reach
//      its screen takes no screenshot at all, so a miss loses a file rather
//      than shipping a lie.
//   2. One broken selector must not hide the other five. A CI capture round
//      trip is ~50 minutes, so a run that stops at the first problem costs a
//      full afternoon to walk six screens.
//
// The run therefore ends green even with misses; scripts/verify-captured-
// screenshots.mjs is what fails the job, by checking the PNGs that actually
// landed on disk. Grep the log for `[capture-miss]` to see why.
final class ScreenshotTests: XCTestCase {
    private let app = XCUIApplication()
    private var misses: [String] = []
    private var isDumpingAccessibility: Bool {
        ProcessInfo.processInfo.environment["KIROKU_DUMP_A11Y"] == "1"
    }

    // `setupSnapshot` and `snapshot` are `@MainActor` in fastlane's bundled
    // SnapshotHelper.swift (2.234.0), so every caller has to be main-actor
    // isolated or the target does not compile:
    //   "call to main actor-isolated global function ... in a synchronous
    //    nonisolated context".
    // The isolation lives on the test method rather than on the class so that
    // nothing here overrides an XCTestCase method: an override cannot add
    // actor isolation its superclass declaration lacks. That is also why there
    // is no `setUpWithError` override; its two lines run at the top of the test
    // instead. There is only one test method, so this is equivalent.
    @MainActor
    func testCaptureAppStoreScreenshots() throws {
        continueAfterFailure = true
        setupSnapshot(app)
        app.launch()

        if isDumpingAccessibility {
            dumpTree("launch")
        }

        guard logIn() else {
            reportMisses()
            return
        }
        switchLocaleIfNeeded()

        if isDumpingAccessibility {
            dumpAccessibilityTrees()
        }

        capture("01_Home") { openHome() }
        capture("02_LiveSession") { openLiveSession() }
        capture("03_DayOverview") { openCalendarDay() }
        capture("04_Statistics") { openStatisticsTab(matching: ["Overview", "Přehled"]) }
        capture("05_AlcoholFree") { openStatisticsTab(matching: ["Trends", "Trendy"]) }
        capture("06_Friends") { openFriends() }
        capture("07_Settings") { openSettings() }

        reportMisses()
    }

    // MARK: - Step plumbing

    /// Runs a navigation step and screenshots only if it actually arrived.
    @MainActor
    private func capture(_ name: String, _ navigate: () -> Bool) {
        guard navigate() else {
            recordMiss(name, "navigation did not reach the screen")
            return
        }
        snapshot(name)
    }

    private func recordMiss(_ name: String, _ reason: String) {
        misses.append("\(name): \(reason)")
        NSLog("[capture-miss] \(name): \(reason)")
        print("[capture-miss] \(name): \(reason)")
        if isDumpingAccessibility {
            dumpTree("miss-\(name)")
        }
    }

    private func reportMisses() {
        guard !misses.isEmpty else {
            NSLog("[capture-summary] all steps reached their screen")
            print("[capture-summary] all steps reached their screen")
            return
        }
        let summary = "[capture-summary] \(misses.count) missed: \(misses.joined(separator: " | "))"
        NSLog("%@", summary)
        print(summary)
    }

    // MARK: - Element lookup

    /// Matches by accessibility label across every element type.
    ///
    /// React Native maps `accessibilityRole` onto different XCUI element types
    /// (a `role="link"` is not in `app.buttons`, a `react-native-tab-view` tab
    /// is neither), so querying a single collection silently misses elements
    /// that are plainly on screen.
    private func element(labeled labels: [String], timeout: TimeInterval = 10) -> XCUIElement? {
        let exact = NSPredicate(format: "label IN %@", labels)
        let match = app.descendants(matching: .any).matching(exact).firstMatch
        if match.waitForExistence(timeout: timeout) {
            return match
        }

        // When a React Native container is marked accessible, its children are
        // merged into one element whose label is everything concatenated, so a
        // menu row can surface as "Preferences, Gear" rather than "Preferences".
        // Fall back to a substring match. A loose match cannot publish the wrong
        // screen, because every capture step still verifies its destination
        // screen appeared before the shutter.
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

    /// Reads a secret from the runner's environment, trimmed. CI secrets can
    /// pick up surrounding whitespace on the way in, and a trailing newline
    /// typed into the password field submits a wrong credential.
    private func credential(_ name: String) -> String {
        let raw = ProcessInfo.processInfo.environment[name] ?? ""
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.count != trimmed.count {
            NSLog("[capture-note] %@ had %d characters of surrounding whitespace, trimmed", name, raw.count - trimmed.count)
        }
        if trimmed.isEmpty {
            NSLog("[capture-note] %@ is empty; the secret is missing from this run", name)
        }
        return trimmed
    }

    /// Types one character at a time. `typeText` delivers the whole string as
    /// fast as the keyboard accepts it, which outruns this app's controlled
    /// `TextInput`: React re-renders the field from a state value that is
    /// still several keystrokes behind, and every keystroke that lands
    /// mid-render is discarded. Pacing lets each `onChangeText` round trip
    /// finish. Mirrors WatchCaptureSignInTests.
    private func typeSlowly(_ text: String, into element: XCUIElement) {
        for character in text {
            element.typeText(String(character))
            usleep(80_000)
        }
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
            NSLog("[capture-note] keyboard still up after tapping away from the form")
        }
    }

    /// Waits for an element to become hittable, i.e. actually on top, not
    /// merely present in the accessibility tree. `waitForExistence` returns
    /// while the boot splash is still dissolving over the first screen, and a
    /// tap in that window hits the overlay instead of the element.
    private func waitUntilHittable(_ element: XCUIElement, timeout: TimeInterval) {
        let deadline = Date().addingTimeInterval(timeout)
        while !element.isHittable && Date() < deadline {
            usleep(250_000)
        }
    }

    /// Taps an element, falling back to its centre coordinate when the element
    /// reports itself as not hittable (common for RN pressables whose child
    /// text owns the frame).
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

    // MARK: - Login

    /// A fresh install lands on `Initial Screen` (the marketing screen with
    /// "Create account" plus a "Log in" link), NOT on the login form. The link
    /// is a `role="link"` pressable, so it is not in `app.buttons`.
    ///
    /// 120s, not 45: a cold ReleaseProduction boot on a busy CI simulator can
    /// sit on the boot splash for well over a minute before the first screen
    /// mounts. Matches WatchCaptureSignInTests.swift's signIn(), which hit
    /// the same "neither Initial Screen nor Auth Screen appeared" miss at a
    /// shorter timeout.
    private func logIn() -> Bool {
        if !screen("Auth Screen", timeout: 5) {
            guard screen("Initial Screen", timeout: 120) else {
                recordMiss("logIn", "neither Initial Screen nor Auth Screen appeared after launch")
                return false
            }
            // common.logInHere
            guard let logInLink = element(labeled: ["Log in", "Přihlaste se zde"], timeout: 20) else {
                recordMiss("logIn", "log-in link not found on Initial Screen")
                return false
            }
            // The screen's testID enters the tree while the native splash is
            // still dissolving over it and the logo entrance animation is
            // starting (InitialScreen arms the animation on splash-hidden), so
            // a single immediate tap can land on the overlay or a still-moving
            // pressable and silently do nothing: link found, event
            // synthesized, no navigation. Wait for the link to be genuinely
            // hittable, then give each tap its own short window to navigate
            // before retrying.
            waitUntilHittable(logInLink, timeout: 10)
            var reachedAuthScreen = false
            for attempt in 1...3 {
                tap(logInLink)
                if screen("Auth Screen", timeout: 10) {
                    reachedAuthScreen = true
                    break
                }
                NSLog("[capture-retry] logIn: tap %d on the log-in link did not open the Auth Screen", attempt)
            }
            guard reachedAuthScreen else {
                recordMiss("logIn", "Auth Screen never appeared after tapping the log-in link")
                return false
            }
        }

        // The form's inputs carry no testID; the first text field is the email
        // and the only secure field is the password.
        let emailField = app.textFields.firstMatch
        guard emailField.waitForExistence(timeout: 10) else {
            recordMiss("logIn", "email field not found on Auth Screen")
            return false
        }
        emailField.tap()
        typeSlowly(credential("APPLE_DEMO_EMAIL"), into: emailField)

        let passwordField = app.secureTextFields.firstMatch
        guard passwordField.waitForExistence(timeout: 5) else {
            recordMiss("logIn", "password field not found on Auth Screen")
            return false
        }
        passwordField.tap()
        typeSlowly(credential("APPLE_DEMO_PASSWORD"), into: passwordField)

        // The submit button sits directly below the password field, so the
        // keyboard covers it: the button stays findable but not hittable, and
        // the coordinate-tap fallback lands on a keyboard key instead, which
        // is why the form was never submitted. Blur the field first, exactly
        // as WatchCaptureSignInTests does.
        dismissKeyboard()

        // common.logIn. Note the capitalisation: en.ts says "Log in", not
        // "Log In", and NSPredicate string comparison is case sensitive.
        guard tapElement(labeled: ["Log in", "Přihlásit se"], timeout: 10) else {
            recordMiss("logIn", "submit button not found on Auth Screen")
            return false
        }

        guard screen("Home Screen", timeout: 60) else {
            recordMiss("logIn", "Home Screen never appeared after submitting credentials")
            return false
        }
        return true
    }

    // MARK: - Locale handling

    /// Kiroku stores locale in Onyx, not at OS level, so fastlane's
    /// `-AppleLanguages` argument is ignored by the app. Switch it in the UI:
    /// Settings -> Preferences -> Language -> Czech.
    ///
    /// The menu is still in English at this point (English is the app default),
    /// which is why the English row titles are the ones that matter; the Czech
    /// spellings are listed only so a re-run on an already-switched account
    /// still works.
    private func switchLocaleIfNeeded() {
        let target = currentSnapshotLanguageInAppCode()
        guard target != "en" else { return }

        guard openSettings() else {
            recordMiss("switchLocale", "Settings tab did not open")
            return
        }
        // common.preferences
        guard tapElement(labeled: ["Preferences", "Předvolby"]) else {
            recordMiss("switchLocale", "Preferences row not found in Settings")
            return
        }
        // languageScreen.language
        guard tapElement(labeled: ["Language", "Jazyk"]) else {
            recordMiss("switchLocale", "Language row not found in Preferences")
            return
        }
        // languageScreen.languages.cs_cz.label, as rendered in either UI language
        guard tapElement(labeled: localeRowTitles(for: target)) else {
            recordMiss("switchLocale", "language row \(localeRowTitles(for: target)) not found")
            return
        }
    }

    private func currentSnapshotLanguageInAppCode() -> String {
        // fastlane's SnapshotHelper sets `-AppleLanguages (lang)` in launchArguments.
        let args = app.launchArguments
        if args.contains(where: { $0.contains("cs") }) { return "cs_cz" }
        return "en"
    }

    private func localeRowTitles(for code: String) -> [String] {
        switch code {
        case "cs_cz": return ["Czech", "Čeština"]
        default:      return ["English", "Angličtina"]
        }
    }

    // MARK: - Selector discovery

    /// Logs the full element tree. Selector work against this app is otherwise
    /// a ~50 minute CI round trip per guess, because nothing shows what a
    /// screen exposes without building and launching it.
    ///
    /// Slices the body: `NSLog` truncates a single message at roughly a
    /// kilobyte, which is a dozen lines of hierarchy, silently swallowing the
    /// rest and leaving only the BEGIN/END markers behind. Mirrors
    /// WatchCaptureSignInTests.swift's dumpHierarchy.
    private func dumpTree(_ label: String) {
        NSLog("[a11y-dump] ===== BEGIN \(label) =====")
        print("[a11y-dump] ===== BEGIN \(label) =====")

        let text = app.debugDescription
        let sliceLength = 800
        var start = text.startIndex
        var index = 0
        while start < text.endIndex {
            let end = text.index(start, offsetBy: sliceLength, limitedBy: text.endIndex) ?? text.endIndex
            let slice = String(text[start..<end])
            NSLog("[a11y-dump] %@ [%d]: %@", label, index, slice)
            print("[a11y-dump] \(label) [\(index)]: \(slice)")
            start = end
            index += 1
        }

        NSLog("[a11y-dump] ===== END \(label) =====")
        print("[a11y-dump] ===== END \(label) =====")
    }

    /// Walks every bottom tab and dumps each one. Never asserts, so a tab that
    /// fails to open logs the miss and the walk continues.
    private func dumpAccessibilityTrees() {
        let tabs = [
            ["Home", "Domů"],
            ["Friends", "Přátelé"],
            ["Statistics", "Statistiky"],
            ["Settings", "Nastavení"],
        ]
        for labels in tabs {
            guard tapElement(labeled: labels, timeout: 8) else {
                NSLog("[a11y-dump] TAB NOT FOUND: \(labels)")
                print("[a11y-dump] TAB NOT FOUND: \(labels)")
                continue
            }
            Thread.sleep(forTimeInterval: 3)
            dumpTree("tab-\(labels.first ?? "?")")
        }
    }

    // MARK: - Navigation
    // Bottom tab buttons carry `accessibilityLabel` = the translated
    // `bottomTabBar.*` string (see createCustomBottomTabNavigator/BottomTabBar).
    // There are exactly four: Home, Friends, Statistics, Settings.

    /// Pops any pushed full-screen back off the stack until the bottom tab
    /// bar is reachable again. On phones a pushed screen (Live Session, Day
    /// Overview) covers the tab bar entirely, so a step that starts from a
    /// tab must first drill out of whatever the previous step left open;
    /// otherwise every capture after 02_LiveSession misses with the tab
    /// unreachable.
    @discardableResult
    private func popToTabBar() -> Bool {
        for _ in 1...3 {
            if element(labeled: ["Home", "Domů"], timeout: 3) != nil {
                return true
            }
            // common.back
            guard let back = element(labeled: ["Back", "Zpět"], timeout: 3) else {
                break
            }
            tap(back)
        }
        return element(labeled: ["Home", "Domů"], timeout: 5) != nil
    }

    private func openHome() -> Bool {
        popToTabBar()
        guard tapElement(labeled: ["Home", "Domů"]) else { return false }
        return screen("Home Screen")
    }

    /// A live session starts from the Home FAB, not from a tab: tap the FAB,
    /// then the "Live" entry in the popover it opens.
    private func openLiveSession() -> Bool {
        guard openHome() else { return false }
        // startSession.newSessionExplained
        guard tapElement(labeled: [
            "Start a session (Floating action)",
            "Spustit relaci (plovoucí tlačítko)",
        ]) else {
            recordMiss("02_LiveSession", "start-session FAB not found on Home")
            return false
        }
        // drinkingSession.live.title
        guard tapElement(labeled: ["Live", "Živá"]) else {
            recordMiss("02_LiveSession", "Live entry not found in the start-session popover")
            return false
        }
        return screen("Live Session Screen", timeout: 25)
    }

    /// Calendar day cells are `calendar-day-<YYYY-MM-DD>` (DayComponent), so a
    /// day is addressed by date rather than by position. KIROKU_DEMO_SESSION_DATES
    /// carries a comma-separated list of dates the demo account actually has
    /// sessions on, newest first, because an empty day opens a Day Overview with
    /// nothing in it and that is not a screenshot worth shipping. Any date that
    /// is not on screen (wrong month, data changed) is skipped, and the last
    /// resort is whatever day cell the calendar is showing.
    private func openCalendarDay() -> Bool {
        guard openHome() else { return false }

        let configured = ProcessInfo.processInfo.environment["KIROKU_DEMO_SESSION_DATES"] ?? ""
        let dates = configured
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        for date in dates {
            let cell = app.descendants(matching: .any)["calendar-day-\(date)"]
            guard cell.waitForExistence(timeout: 3) else { continue }
            tap(cell)
            if screen("Day Overview Screen", timeout: 10) {
                return true
            }
            _ = openHome()
        }

        let anyDay = app.descendants(matching: .any)
            .matching(NSPredicate(format: "identifier BEGINSWITH %@", "calendar-day-"))
            .firstMatch
        guard anyDay.waitForExistence(timeout: 10) else {
            recordMiss("03_DayOverview", "no calendar-day-* cell on Home")
            return false
        }
        tap(anyDay)
        return screen("Day Overview Screen", timeout: 10)
    }

    /// Statistics is a bottom tab whose body is a `react-native-tab-view` with
    /// Overview / Trends / Patterns / Breakdown; `labels` names the inner tab.
    /// The content subtree is dynamically imported behind
    /// `runAfterInteractions`, so the inner tabs appear a beat after the screen.
    private func openStatisticsTab(matching labels: [String]) -> Bool {
        popToTabBar()
        guard tapElement(labeled: ["Statistics", "Statistiky"]) else { return false }
        guard screen("Statistics Screen") else { return false }
        guard tapElement(labeled: labels, timeout: 25) else {
            recordMiss("statistics-tab", "inner tab \(labels) not found")
            return false
        }
        // Give the chart a moment to draw before the shutter.
        Thread.sleep(forTimeInterval: 2)
        return true
    }

    private func openFriends() -> Bool {
        popToTabBar()
        guard tapElement(labeled: ["Friends", "Přátelé"]) else { return false }
        return screen("SocialScreen")
    }

    @discardableResult
    private func openSettings() -> Bool {
        popToTabBar()
        guard tapElement(labeled: ["Settings", "Nastavení"]) else { return false }
        return screen("SettingsScreen")
    }
}
