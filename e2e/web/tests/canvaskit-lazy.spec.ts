import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures/auth';
import {HomePage} from '../pages/HomePage';
import {LoginPage} from '../pages/LoginPage';
import {TabNav} from '../pages/TabNav';

/** The CanvasKit WASM, emitted at the web root by the webpack CopyPlugin. */
const CANVASKIT_WASM = /\/canvaskit\.wasm(\?|$)/;

/**
 * Collect every request the page makes for the CanvasKit WASM. Attach before
 * navigating so a boot-time fetch would be caught.
 */
function trackCanvasKitRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', request => {
    if (CANVASKIT_WASM.test(request.url())) {
      requests.push(request.url());
    }
  });
  return requests;
}

/** True once LoadSkiaWeb has instantiated CanvasKit on the page. */
function isCanvasKitInitialized(page: Page): Promise<boolean> {
  return page.evaluate(
    () => typeof (window as {CanvasKit?: unknown}).CanvasKit !== 'undefined',
  );
}

/**
 * The CanvasKit WASM is ~8 MB raw (~2.4 MB over the wire) and only the
 * Statistics charts need it, so it must stay off the boot path: nothing
 * downloads it until chart code calls `waitForCanvasKit()`
 * (src/libs/skiaWeb.web.ts), which starts the load and memoizes it.
 */
test.describe('CanvasKit lazy load', () => {
  test('is not fetched on the sign-in screen', async ({page}) => {
    const requests = trackCanvasKitRequests(page);
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await expect(loginPage.submitButton()).toBeVisible();

    expect(requests).toEqual([]);
    expect(await isCanvasKitInitialized(page)).toBe(false);
  });

  test('is not fetched when an authenticated session boots to Home', async ({
    authedPage,
  }) => {
    const requests = trackCanvasKitRequests(authedPage);
    const homePage = new HomePage(authedPage);

    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();

    expect(requests).toEqual([]);
    expect(await isCanvasKitInitialized(authedPage)).toBe(false);
  });

  test('is fetched once when the Statistics tab is opened, and not again', async ({
    authedPage,
  }) => {
    const requests = trackCanvasKitRequests(authedPage);
    const homePage = new HomePage(authedPage);
    const tabNav = new TabNav(authedPage);

    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();
    expect(requests).toEqual([]);

    // Statistics mounts its chart tabs, which warm the Skia bundles in the
    // background — that warm-up is what kicks off the WASM download.
    await tabNav.open('Statistics');
    await expect(tabNav.tabScreen('Statistics')).toBeVisible();

    await expect
      .poll(() => requests.length, {
        message: 'CanvasKit WASM was never fetched',
      })
      .toBeGreaterThan(0);
    await expect.poll(() => isCanvasKitInitialized(authedPage)).toBe(true);
    expect(requests).toHaveLength(1);

    // Leaving and coming back must reuse the memoized load rather than
    // re-downloading or re-initializing the WASM.
    await tabNav.open('Home');
    await expect(tabNav.tabScreen('Home')).toBeVisible();
    await tabNav.open('Statistics');
    await expect(tabNav.tabScreen('Statistics')).toBeVisible();

    expect(requests).toHaveLength(1);
  });
});
