import {test, expect} from '../fixtures/auth';
import {LoginPage} from '../pages/LoginPage';
import {HomePage} from '../pages/HomePage';
import {TabNav, type TabName} from '../pages/TabNav';
import {trackErrors} from '../fixtures/consoleErrors';

const E2E_TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? '';
const E2E_TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? '';

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
