import type {ConsoleMessage, Page} from '@playwright/test';
import {test, expect} from '../fixtures/auth';
import {LoginPage} from '../pages/LoginPage';
import {HomePage} from '../pages/HomePage';
import {TabNav, type TabName} from '../pages/TabNav';

const E2E_TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? '';
const E2E_TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? '';

/**
 * Console noise that is known-benign on web and not worth failing a smoke run
 * over (see the #934 web QA pass). Everything else counts as a real error.
 */
const BENIGN_CONSOLE_PATTERNS = [
  'pointerEvents is deprecated',
  'props.pointerEvents is deprecated',
  '"shadow*" style props are deprecated',
  'Download the React DevTools',
];

function isBenign(text: string): boolean {
  return BENIGN_CONSOLE_PATTERNS.some(pattern => text.includes(pattern));
}

/**
 * Start collecting genuine console errors and uncaught page errors. Attach this
 * before navigating so boot-time errors are captured too.
 */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error' && !isBenign(message.text())) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error: Error) => {
    errors.push(error.message);
  });
  return errors;
}

test.describe('web smoke', () => {
  test('signs in with email and password and lands on Home', async ({page}) => {
    test.skip(
      !E2E_TEST_EMAIL || !E2E_TEST_PASSWORD,
      'E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set',
    );

    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);

    await loginPage.goto();
    await expect(loginPage.submitButton()).toBeVisible();

    await loginPage.signIn(E2E_TEST_EMAIL, E2E_TEST_PASSWORD);

    await expect(homePage.screen()).toBeVisible();
  });

  test('boots straight to Home for an authenticated session', async ({
    authedPage,
  }) => {
    const homePage = new HomePage(authedPage);

    await homePage.goto();

    await expect(homePage.screen()).toBeVisible();
  });

  const TABS: TabName[] = ['Friends', 'Statistics', 'Settings'];
  for (const tabName of TABS) {
    test(`navigates from Home to the ${tabName} tab`, async ({authedPage}) => {
      const homePage = new HomePage(authedPage);
      const tabNav = new TabNav(authedPage);

      await homePage.goto();
      await expect(homePage.screen()).toBeVisible();

      await tabNav.open(tabName);

      await expect(tabNav.tabScreen(tabName)).toBeVisible();
    });
  }

  test('walks every core tab without console errors', async ({authedPage}) => {
    const errors = trackErrors(authedPage);
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
