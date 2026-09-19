import {test, expect} from '../fixtures/auth';
import {HomePage} from '../pages/HomePage';
import {DayOverviewPage, localDateString} from '../pages/DayOverviewPage';
import {SessionPage} from '../pages/SessionPage';
import {trackErrors} from '../fixtures/consoleErrors';

/**
 * Calendar navigation: tapping a day on the Home compact calendar opens that
 * day's overview. This is one of the synchronous-mount transitions that has
 * regressed into a "nav freeze" before (see the nav-freeze notes), so the value
 * is in asserting the destination screen actually mounts -- not just that the
 * source highlighted.
 */
test.describe('calendar navigation', () => {
  test("opens today's day overview from the Home calendar and returns", async ({
    authedPage,
  }) => {
    const errors = trackErrors(authedPage);
    const homePage = new HomePage(authedPage);
    const dayOverview = new DayOverviewPage(authedPage);

    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();

    // Today's cell is always present in the current month and (being the max
    // selectable day) is enabled.
    const today = localDateString();
    await dayOverview.openDay(today);
    await expect(dayOverview.screen()).toBeVisible();

    // Back out to Home via browser history (the day overview is a pushed route).
    await authedPage.goBack();
    await expect(homePage.screen()).toBeVisible();

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual(
      [],
    );
  });

  test("opens a session's detail page from the day overview and backs out to it", async ({
    authedPage,
  }) => {
    const homePage = new HomePage(authedPage);
    const dayOverview = new DayOverviewPage(authedPage);
    const session = new SessionPage(authedPage);

    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();

    // A session to open: start, log a drink and save one on today's date.
    await session.startLiveSession();
    const sessionId = session.currentSessionId();
    await session.logOneDrink();
    await session.save();
    await authedPage.goBack();
    await expect(homePage.screen()).toBeVisible();

    // Open a session through today's day overview instead of the Home banner.
    // Any rendered tile will do -- what is under test is where backing out of
    // the detail page lands, not which session it shows. Targeting a specific
    // id would depend on that tile being inside the virtualized list's window.
    const today = localDateString();
    await dayOverview.openDay(today);
    await dayOverview.anySessionTile().click();
    await expect(session.summaryScreen()).toBeVisible();

    // Backing out of the detail page returns to the day overview it was opened
    // from, not to Home: the session modal closes onto whatever is beneath it.
    await session.detailBackButton().click();
    await expect(dayOverview.screen()).toBeVisible();
    await expect(session.summaryScreen()).toBeHidden();

    // Clean up the session this spec created. It is the most recent one, so
    // Home's "Last session" banner opens exactly it.
    await authedPage.goBack();
    await expect(homePage.screen()).toBeVisible();
    await homePage.openLastSession();
    expect(session.currentSessionId()).toBe(sessionId);
    await session.openEditFromSummary();
    await session.discardAndConfirm();
    await expect(homePage.screen()).toBeVisible();
  });
});
