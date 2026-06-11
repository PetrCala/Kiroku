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

  /** Clear any dev gates and wait until the Home screen is mounted. */
  async waitUntilVisible(): Promise<void> {
    await reachAuthenticatedApp(this.page);
  }
}
