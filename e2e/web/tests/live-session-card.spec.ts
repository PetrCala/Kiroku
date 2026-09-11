import type {Locator, Page} from '@playwright/test';
import {test, expect} from '../fixtures/auth';
import {HomePage} from '../pages/HomePage';
import {SessionPage} from '../pages/SessionPage';
import {trackErrors} from '../fixtures/consoleErrors';

/**
 * The Home live card (Sessions v2 W0): while a session is live it sits at the
 * top of Home with a running timer, the units so far, and quick-add buttons
 * that log through the same path as the session screen. Self-cleaning: the
 * session it starts is discarded at the end.
 */

function card(page: Page): Locator {
  return page.getByTestId('live-session-card');
}

function cardElapsed(page: Page): Locator {
  return page.getByTestId('live-session-card-elapsed');
}

function cardUnits(page: Page): Locator {
  return page.getByTestId('live-session-card-units');
}

/** "2.5 units" -> 2.5 */
async function readCardUnits(page: Page): Promise<number> {
  const text = await cardUnits(page).innerText();
  return Number(text.split(' ')[0]);
}

/** Resolve once a running timer shows a different value than it does now. */
async function expectTicking(timer: Locator): Promise<void> {
  const before = await timer.innerText();
  expect(before).toMatch(/^\d+:\d{2}(:\d{2})?$/);
  await expect.poll(() => timer.innerText()).not.toBe(before);
}

test.describe('home live session card', () => {
  test('shows a running session on Home, quick-adds a drink, and opens it', async ({
    authedPage,
  }, testInfo) => {
    const errors = trackErrors(authedPage);
    const homePage = new HomePage(authedPage);
    const session = new SessionPage(authedPage);

    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();

    // Wait for the start to reach the server: the reload below would otherwise
    // race the queued create.
    const created = authedPage.waitForResponse(
      response =>
        response.url().includes('/v1/sessions/update') && response.ok(),
    );
    await session.startLiveSession();
    await created;
    const sessionId = session.currentSessionId();

    // The live screen shows the elapsed timer under its title.
    await expectTicking(authedPage.getByTestId('session-elapsed-time'));

    // A fresh load of the root stays on Home on web (only a native cold start
    // opens the live session), and the persisted live session shows as a card.
    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();
    await expect(session.liveScreen()).toBeHidden();
    await expect(card(authedPage)).toBeVisible();
    await expectTicking(cardElapsed(authedPage));
    await testInfo.attach('home-live-card', {
      body: await authedPage.screenshot(),
      contentType: 'image/png',
    });

    // Quick-add logs a drink without leaving Home.
    const unitsBefore = await readCardUnits(authedPage);
    await authedPage
      .getByTestId(/^live-session-card-add-/)
      .first()
      .click();
    await expect
      .poll(() => readCardUnits(authedPage))
      .toBeGreaterThan(unitsBefore);
    await expect(session.liveScreen()).toBeHidden();
    const unitsAfter = await readCardUnits(authedPage);
    await testInfo.attach('home-live-card-after-quick-add', {
      body: await authedPage.screenshot(),
      contentType: 'image/png',
    });

    // Tapping the card opens this live session, with the quick-added drink.
    await card(authedPage).click();
    await session.liveScreen().waitFor({state: 'visible'});
    await expect(authedPage).toHaveURL(
      new RegExp(`drinking-session/${sessionId}/live`),
    );
    await expect(session.totalUnits()).toHaveText(String(unitsAfter));
    await testInfo.attach('live-session-screen', {
      body: await authedPage.screenshot(),
      contentType: 'image/png',
    });

    // Clean up: discard, and the card goes away. Wait for the delete to reach
    // the server: the context closes right after the test, and a delete still
    // in the request queue would leave a live session on the shared account.
    const deleted = authedPage.waitForResponse(
      response =>
        response.url().includes('/v1/sessions/delete') && response.ok(),
    );
    await session.discardAndConfirm();
    await deleted;
    await expect(homePage.screen()).toBeVisible();
    await expect(card(authedPage)).toBeHidden();

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual(
      [],
    );
  });
});
