import {test, expect} from '../fixtures/auth';
import {HomePage} from '../pages/HomePage';
import {TabNav, type TabName} from '../pages/TabNav';
import {trackErrors} from '../fixtures/consoleErrors';

/**
 * Desktop "phone frame" coverage (#1219 -> fixed in #1224).
 *
 * Above the 800px responsive breakpoint the app no longer shows the wide
 * Expensify layout (which pinned the tab roots to a ~375px column and left the
 * central pane empty). Instead it renders its mobile layout centered in a
 * ~480px column on a backdrop, and reports that width to the layout engine so
 * the framed app behaves exactly like mobile. These tests drive the
 * authenticated app at a desktop viewport and assert (a) the frame is actually
 * applied and (b) the framed layout stays navigable and console-clean.
 *
 * Note: the auth fixture creates its own browser context, so the project's
 * (mobile) viewport does not apply to `authedPage` -- we set the desktop size
 * explicitly here.
 */
const DESKTOP_VIEWPORT = {width: 1440, height: 900};

// Keep in sync with FRAME_WIDTH in index.web.js and the #root width in
// web/index.html.
const FRAME_WIDTH = 480;

test.describe('web desktop phone frame', () => {
  test('renders the app as a centered phone-width column on a wide window', async ({
    authedPage,
  }) => {
    await authedPage.setViewportSize(DESKTOP_VIEWPORT);

    const homePage = new HomePage(authedPage);
    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();

    // #root is capped to the frame width and horizontally centered rather than
    // filling the full 1440px window.
    const box = await authedPage.locator('#root').boundingBox();
    expect(box, '#root should have a layout box').not.toBeNull();
    if (!box) {
      return;
    }

    // Width clamped to the phone frame (small tolerance for borders/rounding).
    expect(box.width).toBeLessThanOrEqual(FRAME_WIDTH + 40);
    expect(box.width).toBeGreaterThanOrEqual(FRAME_WIDTH - 40);

    // Clearly inset from both edges and centered (equal left/right gaps).
    const leftGap = box.x;
    const rightGap = DESKTOP_VIEWPORT.width - (box.x + box.width);
    expect(leftGap).toBeGreaterThan(100);
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(8);
  });

  test('keeps the framed desktop layout navigable without console errors', async ({
    authedPage,
  }) => {
    const errors = trackErrors(authedPage);
    await authedPage.setViewportSize(DESKTOP_VIEWPORT);

    const homePage = new HomePage(authedPage);
    const tabNav = new TabNav(authedPage);

    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();

    const tour: TabName[] = ['Friends', 'Statistics', 'Settings', 'Home'];
    for (const tabName of tour) {
      await tabNav.open(tabName);
      await expect(tabNav.tabScreen(tabName)).toBeVisible();
    }

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual(
      [],
    );
  });
});
