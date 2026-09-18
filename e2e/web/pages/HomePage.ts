import type {Locator, Page} from '@playwright/test';
import {reachAuthenticatedApp} from '../fixtures/devGates';

/**
 * Page Object for the Home tab root (`HomeScreen`, the calendar view), which is
 * where the app lands after a successful sign-in.
 *
 * Actions and locators only -- assertions live in the specs.
 */
export class HomePage {
  constructor(private readonly page: Page) {}

  /**
   * Open the app root and land on Home. An already-authenticated context boots
   * here, but on a dev/staging build the email-verification gate is re-shown on
   * every fresh load for an unverified account, so clear any such gate before
   * returning.
   */
  async goto(): Promise<void> {
    await this.page.goto('/');
    await reachAuthenticatedApp(this.page);
  }

  // `testID` becomes `data-testid` under react-native-web.
  screen(): Locator {
    return this.page.getByTestId('Home Screen');
  }

  // The header's avatar + display-name button, which opens the signed-in
  // user's own Profile. It carries no label (its name is the account's display
  // name), but it is always the first button on Home.
  profileEntry(): Locator {
    return this.screen().getByRole('button').first();
  }

  // The "Last session" banner (`HomeBanner`, neutral tone), shown once the user
  // has a completed session and no live one. Its accessible name is the
  // `homeScreen.banners.lastSession.a11y` string.
  lastSessionBanner(): Locator {
    return this.page.getByRole('button', {name: /^View your last session/});
  }

  /** Open the most recent session's detail page from the Home banner. */
  async openLastSession(): Promise<void> {
    await this.lastSessionBanner().click();
    await this.page.waitForURL(/drinking-session\/[^/]+\/summary/);
  }

  /** Open the signed-in user's own Profile from the Home header. */
  async openOwnProfile(): Promise<void> {
    await this.profileEntry().click();
    await this.page.waitForURL(/\/profile\//);
  }

  /** Clear any dev gates and wait until the Home screen is mounted. */
  async waitUntilVisible(): Promise<void> {
    await reachAuthenticatedApp(this.page);
  }
}
