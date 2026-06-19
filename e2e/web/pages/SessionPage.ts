import type {Locator, Page} from '@playwright/test';

/**
 * Page Object for the drinking-session lifecycle: the Home start-session FAB,
 * the live/edit session window (`DrinkingSessionWindow`), and the post-save
 * session summary.
 *
 * Actions and locators only -- assertions live in the specs.
 */
export class SessionPage {
  constructor(private readonly page: Page) {}

  // The floating action button on Home that opens the start-session popover
  // (`StartSessionButtonAndPopover`). Its accessibility label is the
  // `startSession.newSessionExplained` string.
  fab(): Locator {
    return this.page.getByRole('button', {
      name: 'Start a session (Floating action)',
    });
  }

  // Popover items render as `MenuItem`s whose accessible name is the session
  // type title (`drinkingSession.live.title` / `.edit.title`). "Live" starts a
  // live session immediately; "Edit" creates a back-dated (past) session.
  liveSessionMenuItem(): Locator {
    return this.page.getByRole('menuitem', {name: 'Live', exact: true});
  }

  // The live drinking-session screen (`LiveSessionScreen.displayName`).
  liveScreen(): Locator {
    return this.page.getByTestId('Live Session Screen');
  }

  // The edit drinking-session screen (`EditSessionScreen.displayName`), reached
  // from a saved session's summary via the header edit button.
  editScreen(): Locator {
    return this.page.getByTestId('Edit Session Screen');
  }

  // The post-save read-only summary (`SessionSummaryScreen.displayName`).
  summaryScreen(): Locator {
    return this.page.getByTestId('Session Summary Screen');
  }

  // The headline unit count on the session window (testID added in
  // `DrinkingSessionWindow`). Reads "0" until a drink is logged.
  totalUnits(): Locator {
    return this.page.getByTestId('session-total-units');
  }

  // The per-drink-type "+"/"-" steppers carry `add-drink-<key>` /
  // `remove-drink-<key>` testIDs (one row per drink type). Any "+" adds units,
  // so the smoke flow targets the first.
  firstAddDrinkButton(): Locator {
    return this.page.getByTestId(/^add-drink-/).first();
  }

  saveButton(): Locator {
    return this.page.getByRole('button', {name: 'Save Session', exact: true});
  }

  // Same button for both wordings: "Discard Session" (live) / "Delete Session"
  // (a saved session being edited).
  discardButton(): Locator {
    return this.page.getByRole('button', {
      name: /^(Discard|Delete) Session$/,
    });
  }

  // The destructive-confirm modal's affirmative action.
  confirmYesButton(): Locator {
    return this.page.getByRole('button', {name: 'Yes', exact: true});
  }

  // The edit affordance in the summary header (icon-only `Button`, testID
  // `summary-edit-session`). Loads the session into the edit buffer and opens
  // the edit screen.
  summaryEditButton(): Locator {
    return this.page.getByTestId('summary-edit-session');
  }

  /** Open the FAB popover and start a live session; resolve on the live screen. */
  async startLiveSession(): Promise<void> {
    await this.fab().click();
    await this.liveSessionMenuItem().click();
    await this.liveScreen().waitFor({state: 'visible'});
  }

  /**
   * The session id is carried in the session-screen URL
   * (`/drinking-session/<id>/live` and, after save, `/.../summary`). The saved
   * session keeps the same id, so specs use it to assert on the exact session.
   */
  currentSessionId(): string {
    const match = /drinking-session\/([^/]+)\//.exec(this.page.url());
    if (!match) {
      throw new Error(
        `Could not parse a session id from URL: ${this.page.url()}`,
      );
    }
    return match[1];
  }

  /** Tap the first drink's "+" once. */
  async logOneDrink(): Promise<void> {
    await this.firstAddDrinkButton().click();
  }

  /** Save the session; resolve on the summary screen. */
  async save(): Promise<void> {
    await this.saveButton().click();
    await this.summaryScreen().waitFor({state: 'visible'});
  }

  /** From the summary, open the edit screen for the saved session. */
  async openEditFromSummary(): Promise<void> {
    await this.summaryEditButton().click();
    await this.editScreen().waitFor({state: 'visible'});
  }

  /** Discard/delete the open session and confirm the warning modal. */
  async discardAndConfirm(): Promise<void> {
    await this.discardButton().click();
    await this.confirmYesButton().click();
  }
}
