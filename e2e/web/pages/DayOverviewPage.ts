import type {Locator, Page} from '@playwright/test';

/** Local calendar day (`YYYY-MM-DD`) for the machine running the test. */
export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Page Object for the Day Overview screen (`DayOverviewScreen.displayName`),
 * reached by tapping a day cell in the Home compact calendar. Lists that day's
 * drinking sessions and, in edit mode, exposes a per-tile edit affordance.
 *
 * Actions and locators only -- assertions live in the specs.
 */
export class DayOverviewPage {
  constructor(private readonly page: Page) {}

  // A calendar day cell on Home. testID `calendar-day-<YYYY-MM-DD>` was added to
  // `DayComponent` so a specific (e.g. today's) cell can be tapped without
  // relying on the bare day-number text, which is ambiguous across the grid.
  dayCell(dateString: string): Locator {
    return this.page.getByTestId(`calendar-day-${dateString}`);
  }

  screen(): Locator {
    return this.page.getByTestId('Day Overview Screen');
  }

  // The header Edit/Done toggle (self only): accessibility label flips between
  // `common.edit` and `common.done`.
  editModeToggle(): Locator {
    return this.page.getByRole('button', {name: 'Edit', exact: true});
  }

  doneModeToggle(): Locator {
    return this.page.getByRole('button', {name: 'Done', exact: true});
  }

  // A session tile, identified by its `dayOverviewScreen.sessionWindow`
  // accessibility label which embeds the session id.
  sessionTile(sessionId: string): Locator {
    return this.page.getByRole('button', {
      name: `Drinking session: ${sessionId}`,
    });
  }

  // The empty-day message (`dayOverviewScreen.noDrinkingSessions`).
  emptyState(): Locator {
    return this.page.getByText('No drinking sessions', {exact: true});
  }

  /** Tap a Home calendar day cell; resolve on the Day Overview screen. */
  async openDay(dateString: string): Promise<void> {
    await this.dayCell(dateString).click();
    await this.screen().waitFor({state: 'visible'});
  }

  /** Turn the per-tile edit affordances on. */
  async enableEditMode(): Promise<void> {
    await this.editModeToggle().click();
    await this.doneModeToggle().waitFor({state: 'visible'});
  }
}
