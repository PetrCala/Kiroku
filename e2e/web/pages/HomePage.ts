import type {Locator, Page} from '@playwright/test';

/**
 * Page Object for the Home tab root (`HomeScreen`, the calendar view), which is
 * where the app lands after a successful sign-in.
 *
 * Actions and locators only -- assertions live in the specs.
 */
export class HomePage {
  constructor(private readonly page: Page) {}

  /** Open the app root (already-authenticated contexts land here). */
  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  // `testID` becomes `data-testid` under react-native-web.
  screen(): Locator {
    return this.page.getByTestId('Home Screen');
  }

  /** Wait until the Home screen has mounted and is visible. */
  async waitUntilVisible(): Promise<void> {
    await this.screen().waitFor({state: 'visible'});
  }
}
