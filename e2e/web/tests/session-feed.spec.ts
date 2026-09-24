import type {Page, Request} from '@playwright/test';
import {test, expect} from '../fixtures/auth';
import {HomePage} from '../pages/HomePage';
import {SessionPage} from '../pages/SessionPage';
import {trackErrors} from '../fixtures/consoleErrors';
import {overrideRemoteFeatureFlags} from '../fixtures/featureFlags';

/**
 * The Home session feed (Sessions v2 W5, RFC §10): with the `SESSION_FEED`
 * flag on, Home lists the user's sessions below the calendar, newest first,
 * pages older ones in from `GET /v1/users/:uid/sessions?limit=`, and shows
 * the live session with a live badge. The flag ships off, so the spec turns it
 * on through a remote override injected into the app-open response (never
 * written to the shared dev RTDB). Self-cleaning: the session it starts is
 * discarded at the end.
 */

/** A paged sessions read: `limit` marks the feed's shape of the route. */
function isSessionsPageRequest(request: Request): boolean {
  const url = new URL(request.url());
  return (
    request.method() === 'GET' &&
    /\/v1\/users\/[^/]+\/sessions$/.test(url.pathname) &&
    url.searchParams.has('limit')
  );
}

function recordSessionsPageRequests(page: Page): Request[] {
  const requests: Request[] = [];
  page.on('request', request => {
    if (isSessionsPageRequest(request)) {
      requests.push(request);
    }
  });
  return requests;
}

test.describe('home session feed', () => {
  test('is absent while the flag is off', async ({authedPage}) => {
    const errors = trackErrors(authedPage);
    const homePage = new HomePage(authedPage);
    await overrideRemoteFeatureFlags(authedPage, {});

    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();
    await expect(homePage.feed()).toHaveCount(0);

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual(
      [],
    );
  });

  test('lists sessions below the calendar, pages older ones, and badges the live one', async ({
    authedPage,
  }, testInfo) => {
    const errors = trackErrors(authedPage);
    const homePage = new HomePage(authedPage);
    const session = new SessionPage(authedPage);
    const pageRequests = recordSessionsPageRequests(authedPage);
    await overrideRemoteFeatureFlags(authedPage, {SESSION_FEED: true});

    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();
    await expect(homePage.feed()).toBeVisible();

    // Whatever the account's history, the feed asks the server for the page
    // below what it holds as soon as the end of the list is in view, and the
    // request carries the feed's page size.
    await expect.poll(() => pageRequests.length).toBeGreaterThan(0);
    const firstPage = new URL(pageRequests[0].url());
    expect(firstPage.searchParams.get('limit')).toBe('20');
    await testInfo.attach('home-feed', {
      body: await authedPage.screenshot(),
      contentType: 'image/png',
    });

    // Start a live session: back on Home its card leads the feed, badged live.
    await session.startLiveSession();
    const sessionId = session.currentSessionId();
    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();
    await expect(homePage.feedCard(sessionId)).toBeVisible();
    await expect(homePage.feedLiveBadge(sessionId)).toBeVisible();
    await expect(homePage.feedCards().first()).toHaveAttribute(
      'data-testid',
      `session-feed-card-${sessionId}`,
    );
    await testInfo.attach('home-feed-live-card', {
      body: await authedPage.screenshot(),
      contentType: 'image/png',
    });

    // Its card opens the live session.
    await homePage.feedCard(sessionId).click();
    await session.liveScreen().waitFor({state: 'visible'});
    await expect(authedPage).toHaveURL(
      new RegExp(`drinking-session/${sessionId}/live`),
    );

    // Clean up: discard, and the card goes with it.
    await session.discardAndConfirm();
    await expect(homePage.screen()).toBeVisible();
    await expect(homePage.feedCard(sessionId)).toHaveCount(0);

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual(
      [],
    );
  });
});
