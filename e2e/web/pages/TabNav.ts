import type {Locator, Page} from '@playwright/test';

/** The four bottom-tab roots, in bar order (see `bottomTabConfig.ts`). */
export type TabName = 'Home' | 'Friends' | 'Statistics' | 'Settings';

/**
 * Maps each tab to the `testID` (-> `data-testid`) of the screen it reveals, so
 * specs can assert the destination actually rendered rather than just that the
 * tab highlighted. All four roots stay mounted; only the active one is visible.
 */
export const TAB_SCREEN_TEST_ID: Record<TabName, string> = {
  Home: 'Home Screen',
  Friends: 'SocialScreen',
  Statistics: 'Statistics Screen',
  Settings: 'SettingsScreen',
};

/**
 * Page Object for the bottom tab bar.
 *
 * Actions and locators only -- assertions live in the specs.
 */
export class TabNav {
  constructor(private readonly page: Page) {}

  /** The tab button itself (renders as `role=button` with the tab label). */
  tab(name: TabName): Locator {
    return this.page.getByRole('button', {name, exact: true});
  }

  /** The screen a tab reveals once selected. */
  tabScreen(name: TabName): Locator {
    return this.page.getByTestId(TAB_SCREEN_TEST_ID[name]);
  }

  /** Tap a tab to switch to its root. */
  async open(name: TabName): Promise<void> {
    await this.tab(name).click();
  }
}
