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

  // A session tile, exposed as a button named by its
  // `dayOverviewScreen.sessionWindow` accessibility label, which embeds the
  // session id. Matched exactly so one id can't match a longer one.
  sessionTile(sessionId: string): Locator {
    return this.page.getByRole('button', {
      name: `Drinking session: ${sessionId}`,
      exact: true,
    });
  }

  /**
   * Scroll a session's tile into the DOM and return it.
   *
   * The screen is one continuous, virtualized (`FlashList`) scroll across every
   * day the app has loaded, and it lands centered on the day it was opened at.
   * Only the rows around that landing point are rendered, so a tile further
   * down is not in the DOM at all and waiting on the locator alone waits
   * forever (`locator.click()` has no action timeout of its own, so it burns
   * the whole test budget). Days run oldest to newest, so a tile that isn't up
   * yet is below: wheel down over the list until it renders.
   *
   * Bounded, and it asserts on the tile at the end, so a tile that never shows
   * up fails in seconds with the locator in the message.
   */
  async revealSessionTile(sessionId: string): Promise<Locator> {
    const tile = this.sessionTile(sessionId);
    await this.screen().hover();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (await tile.isVisible().catch(() => false)) {
        return tile;
      }
      await this.page.mouse.wheel(0, 600);
      // Let the list render the rows the scroll brought into range.
      await this.page.waitForTimeout(200);
    }
    await tile.waitFor({state: 'visible', timeout: 5_000});
    return tile;
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
