import {test, expect} from '../fixtures/auth';
import {HomePage} from '../pages/HomePage';
import {SessionPage} from '../pages/SessionPage';
import {trackErrors} from '../fixtures/consoleErrors';

/**
 * The drinking-session lifecycle is Kiroku's core flow: start a session, log a
 * drink, save it, and later edit/delete it. These specs drive it end to end
 * against the dev backend and assert observable outcomes (the unit count, the
 * screen the app lands on, and that the saved session round-trips with the
 * logged units) rather than just that a screen mounted.
 *
 * Both tests are self-cleaning: the lifecycle test deletes the session it
 * creates, and the discard test never persists one. That keeps the shared dev
 * test account from accumulating sessions across CI runs.
 */
test.describe('drinking session lifecycle', () => {
  test('creates a live session, logs a drink, saves it, then deletes it', async ({
    authedPage,
  }) => {
    const errors = trackErrors(authedPage);
    const homePage = new HomePage(authedPage);
    const session = new SessionPage(authedPage);

    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();

    // Start a live session and log one drink.
    await session.startLiveSession();
    const sessionId = session.currentSessionId();

    // Capture the starting count rather than assuming zero, so the test is
    // robust if a prior ongoing session is resumed on the shared dev account.
    const unitsBefore = Number(await session.totalUnits().innerText());

    await session.logOneDrink();
    // Logging a drink increments the unit count and enables Save.
    await expect
      .poll(async () => Number(await session.totalUnits().innerText()))
      .toBeGreaterThan(unitsBefore);
    await expect(session.saveButton()).toBeEnabled();

    const loggedUnits = await session.totalUnits().innerText();

    // Save -> the read-only summary for this exact session.
    await session.save();
    await expect(authedPage).toHaveURL(
      new RegExp(`drinking-session/${sessionId}/summary`),
    );

    // Re-open the saved session through the summary's edit button: it loads the
    // persisted session into the edit buffer, so the unit count surviving the
    // save round-trip proves the drink actually persisted.
    await session.openEditFromSummary();
    await expect(session.totalUnits()).toHaveText(loggedUnits);

    // Delete it and confirm. The edit screen pops back out of the session modal
    // flow, landing on Home.
    await session.discardAndConfirm();
    await expect(homePage.screen()).toBeVisible();
    await expect(session.editScreen()).toBeHidden();

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual(
      [],
    );
  });

  test('discards an in-progress session without persisting it', async ({
    authedPage,
  }) => {
    const homePage = new HomePage(authedPage);
    const session = new SessionPage(authedPage);

    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();

    await session.startLiveSession();
    const unitsBefore = Number(await session.totalUnits().innerText());
    await session.logOneDrink();
    await expect
      .poll(async () => Number(await session.totalUnits().innerText()))
      .toBeGreaterThan(unitsBefore);

    // Discard -> warning modal -> confirm. Returns to Home with nothing saved.
    await session.discardAndConfirm();
    await expect(homePage.screen()).toBeVisible();
    await expect(session.liveScreen()).toBeHidden();
  });
});
