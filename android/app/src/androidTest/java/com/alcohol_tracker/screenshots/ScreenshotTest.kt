package com.alcohol_tracker.screenshots

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.ActivityTestRule
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.alcohol_tracker.MainActivity
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import tools.fastlane.screengrab.Screengrab
import tools.fastlane.screengrab.UiAutomatorScreenshotStrategy
import tools.fastlane.screengrab.locale.LocaleTestRule

/**
 * Captures Play Store screenshots for the locale matrix declared in
 * fastlane/Screengrabfile. screengrab invokes this once per locale.
 *
 * IMPORTANT — manual setup required before this file compiles. See SCREENSHOTS.md:
 *   1. Add the screengrab dependency to android/app/build.gradle.
 *   2. Set `testInstrumentationRunner` to "androidx.test.runner.AndroidJUnitRunner".
 *   3. Set `KIROKU_DEMO_EMAIL` / `KIROKU_DEMO_PASSWORD` env vars before running.
 */
@RunWith(AndroidJUnit4::class)
class ScreenshotTest {

    @Rule @JvmField
    val localeTestRule = LocaleTestRule()

    @Rule @JvmField
    val activityRule = ActivityTestRule(MainActivity::class.java)

    private val device: UiDevice =
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())

    private val email: String =
        InstrumentationRegistry.getArguments().getString("demoEmail")
            ?: System.getenv("KIROKU_DEMO_EMAIL")
            ?: ""

    private val password: String =
        InstrumentationRegistry.getArguments().getString("demoPassword")
            ?: System.getenv("KIROKU_DEMO_PASSWORD")
            ?: ""

    @Before
    fun setup() {
        Screengrab.setDefaultScreenshotStrategy(UiAutomatorScreenshotStrategy())
    }

    @Test
    fun captureAppStoreScreenshots() {
        logIn()
        switchLocaleIfNeeded()
        returnToHome()

        Screengrab.screenshot("01_Home")

        openStartSession()
        Screengrab.screenshot("02_LiveSession")

        openCalendarDay()
        Screengrab.screenshot("03_DayOverview")

        openProfile()
        Screengrab.screenshot("04_Profile")

        openSettings()
        Screengrab.screenshot("05_Settings")
    }

    // ---- Login ----------------------------------------------------------------

    private fun logIn() {
        device.wait(Until.findObject(By.desc("AuthScreen")), 30_000)

        // RN TextInput → Android EditText. Match by index since there are no testIDs.
        val edits = device.findObjects(By.clazz("android.widget.EditText"))
        check(edits.size >= 2) { "Expected email + password fields on AuthScreen" }
        edits[0].text = email
        edits[1].text = password

        // Submit button — matched by its localized text.
        clickByText(listOf("Log In", "Přihlásit se", "Sign In"))

        device.wait(Until.findObject(By.desc("Home Screen")), 30_000)
    }

    // ---- Locale ---------------------------------------------------------------

    /**
     * Kiroku stores locale in Onyx, not the system locale. LocaleTestRule sets
     * Android's locale, but the app ignores it — we navigate Settings → Language
     * and pick the matching option based on the JUnit argument injected by
     * fastlane (`-e package com.alcohol_tracker.screenshots` runs per locale).
     */
    private fun switchLocaleIfNeeded() {
        val target = InstrumentationRegistry.getArguments().getString("locale") ?: "en"
        if (target == "en") return  // app default

        openSettings()
        clickByText(listOf("Preferences", "Předvolby"))
        clickByText(listOf("Language", "Jazyk"))
        clickByText(if (target == "cs_cz") listOf("Čeština", "Czech") else listOf("English"))
    }

    // ---- Navigation -----------------------------------------------------------

    private fun returnToHome() {
        clickByText(listOf("Start", "Začít", "Home", "Domů"))
    }

    private fun openStartSession() {
        clickByText(listOf("Start", "Začít"))
        if (device.wait(Until.findObject(By.desc("Live Session Screen")), 5_000) == null) {
            clickByText(listOf("Start Session", "Spustit session"))
        }
        device.wait(Until.findObject(By.desc("Live Session Screen")), 10_000)
    }

    private fun openCalendarDay() {
        clickByText(listOf("Statistics", "Statistiky", "Calendar", "Kalendář"))
        device.findObject(By.desc("DayMarking"))?.click()
        device.wait(Until.findObject(By.desc("Day Overview Screen")), 5_000)
    }

    private fun openProfile() {
        openSettings()
        clickByText(listOf("Profile", "Profil"))
        device.wait(Until.findObject(By.desc("Profile Screen")), 5_000)
    }

    private fun openSettings() {
        clickByText(listOf("Settings", "Nastavení"))
        device.wait(Until.findObject(By.desc("SettingsScreen")), 5_000)
    }

    private fun clickByText(candidates: List<String>) {
        for (label in candidates) {
            device.findObject(By.text(label))?.let {
                it.click()
                return
            }
        }
    }
}
