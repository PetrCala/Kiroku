import {test, expect} from '../fixtures/auth';
import {HomePage} from '../pages/HomePage';
import {DayOverviewPage, localDateString} from '../pages/DayOverviewPage';
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
});
