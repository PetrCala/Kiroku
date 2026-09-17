import type {Locator, Page} from '@playwright/test';
import {isEndOp} from '../fixtures/e2eHooks';

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

  // --- Session detail page (the evolved summary, RFC §9) -------------------

  // The session's name in the detail page header.
  detailName(): Locator {
    return this.page.getByTestId('session-detail-name');
  }

  // One of the three stats in the detail page's hero strip.
  detailStat(stat: 'duration' | 'units' | 'drinks'): Locator {
    return this.page.getByTestId(`session-stat-${stat}`);
  }

  // A row of the drink breakdown, one per drink type the session contains.
  detailDrinkRow(drinkKey: string): Locator {
    return this.page.getByTestId(`session-drink-${drinkKey}`);
  }

  // Any row of the breakdown, for counting how many types are shown.
  detailDrinkRows(): Locator {
    return this.page.getByTestId(/^session-drink-/);
  }

  // The photo gallery's add action (`UploadImage` with the session kind).
  addPhotoButton(): Locator {
    return this.page.getByTestId('session-add-photo');
  }

  // The per-drink-type "+"/"-" steppers carry `add-drink-<key>` /
  // `remove-drink-<key>` testIDs (one row per drink type). Any "+" adds units,
  // so the smoke flow targets the first.
  firstAddDrinkButton(): Locator {
    return this.page.getByTestId(/^add-drink-/).first();
  }

  // Same button for both wordings: "End session" (live) / "Save Session" (a
  // saved session being edited).
  saveButton(): Locator {
    return this.page.getByRole('button', {
      name: /^(End session|Save Session)$/,
    });
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

  /**
   * Resolve on the next successful response from a session endpoint. Session
   * writes go through the app's persisted request queue, which lives in the
   * browser context's IndexedDB; Playwright closes that context as soon as a
   * test ends, so a write still sitting in the queue is lost with it. Awaiting
   * the response makes sure the write reached the dev backend.
   *
   * Saving takes one of two endpoints depending on `SESSION_OPS`: a legacy
   * session (or a switched-off flag) finalizes with a whole-session
   * `POST /v1/sessions/update`, while a schema 2 session writes ops. Either one
   * means the save landed, so this accepts both rather than the caller having
   * to know which path the app took.
   *
   * On the op path, WHICH op ends the save depends on the screen, and the two
   * cases need different rules:
   *
   * - A LIVE session closes with an `end` op, but its drinks already went out
   *   as their own ops while it ran. Matching the endpoint alone would resolve
   *   on one of those still in flight and let the test move on before the save
   *   reached the server, so the live case matches the body naming `end`.
   * - An EDIT session never sends `end` (it is already ended) and its
   *   mutations stay in the buffer until the save diffs them out, so the first
   *   op of any kind after the click belongs to this save. Waiting for `end`
   *   here would wait forever.
   */
  private waitForSessionWrite(
    endpoint: 'update' | 'delete',
    kind: 'live' | 'edit' = 'live',
  ): Promise<unknown> {
    return this.page.waitForResponse(response => {
      if (!response.ok()) {
        return false;
      }
      const url = response.url();
      if (url.includes(`/v1/sessions/${endpoint}`)) {
        return true;
      }
      if (endpoint !== 'update' || !url.includes('/v1/sessions/ops')) {
        return false;
      }
      return kind === 'edit' || isEndOp(response.request().postData());
    });
  }

  /**
   * Save the session; resolve on the summary screen once the save reached the
   * server.
   */
  async save(): Promise<void> {
    // Which screen is saving decides which write to wait for, so callers keep
    // saying `save()` on both the live screen and the edit screen.
    const isEdit = await this.editScreen()
      .isVisible()
      .catch(() => false);
    const saved = this.waitForSessionWrite('update', isEdit ? 'edit' : 'live');
    await this.saveButton().click();
    await this.summaryScreen().waitFor({state: 'visible'});
    await saved;
  }

  // The detail page's header back arrow (`HeaderWithBackButton`, labelled
  // `common.back`). Distinct from browser back: this is the in-app handler.
  detailBackButton(): Locator {
    return this.summaryScreen().getByRole('button', {
      name: 'Back',
      exact: true,
    });
  }

  /** From the summary, open the edit screen for the saved session. */
  async openEditFromSummary(): Promise<void> {
    await this.summaryEditButton().click();
    await this.editScreen().waitFor({state: 'visible'});
  }

  /**
   * Discard/delete the open session and confirm the warning modal; resolve once
   * the delete reached the server, so a test ending right after it does not
   * leave the session behind on the shared dev account.
   */
  async discardAndConfirm(): Promise<void> {
    const deleted = this.waitForSessionWrite('delete');
    await this.discardButton().click();
    await this.confirmYesButton().click();
    await deleted;
  }
}
