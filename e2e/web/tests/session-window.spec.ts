import type {Request} from '@playwright/test';
import {test, expect} from '../fixtures/auth';
import {HomePage} from '../pages/HomePage';
import {trackErrors} from '../fixtures/consoleErrors';

/**
 * App open no longer loads the whole session history (Sessions v2 W5, RFC
 * §10): the bootstrap `GET /v1/app/open` carries a `sessionsFrom` floor at the
 * start of the month three months back, so the snapshot is a window the
 * calendar and the feed widen on demand. Unflagged: every launch does this.
 */

function isAppOpen(request: Request): boolean {
  return (
    request.method() === 'GET' &&
    new URL(request.url()).pathname.endsWith('/v1/app/open')
  );
}

test.describe('windowed app open', () => {
  test('boots with a sessions floor three months back', async ({
    authedPage,
  }) => {
    const errors = trackErrors(authedPage);
    const homePage = new HomePage(authedPage);
    const opens: Request[] = [];
    authedPage.on('request', request => {
      if (isAppOpen(request)) {
        opens.push(request);
      }
    });

    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();
    await expect.poll(() => opens.length).toBeGreaterThan(0);

    const floor = Number(
      new URL(opens[0].url()).searchParams.get('sessionsFrom'),
    );
    const now = new Date();
    const expected = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    expect(floor).toBe(expected.getTime());

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual(
      [],
    );
  });
});
