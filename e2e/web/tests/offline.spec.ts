import {test, expect} from '../fixtures/auth';
import {HomePage} from '../pages/HomePage';
import {TabNav, type TabName} from '../pages/TabNav';

/**
 * Offline-first resilience: losing the network must not break the app. With a
 * warm (already-loaded) session, the user should still be able to move between
 * the cached tab roots while offline, and everything should keep working once
 * the connection returns. We drive the browser context's offline state, which
 * flips `navigator.onLine` and blocks the network the way a real drop would.
 *
 * Note: this intentionally does NOT assert the OfflineIndicator banner. On the
 * web dev build it does not surface under simulated offline (the NetInfo ->
 * NETWORK bridge does not flip from `navigator.onLine`); see the PR description
 * for that finding. This test covers the behavior that IS deterministic and
 * matters most for launch -- the app stays usable offline and recovers.
 */
test.describe('offline resilience', () => {
  test('stays navigable while offline and after reconnecting', async ({
    authedPage,
  }) => {
    const homePage = new HomePage(authedPage);
    const tabNav = new TabNav(authedPage);

    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();

    // Drop the connection, then walk the cached tab roots: each destination
    // must still mount (no freeze, no crash, no forced sign-out).
    await authedPage.context().setOffline(true);

    const offlineTour: TabName[] = [
      'Friends',
      'Statistics',
      'Settings',
      'Home',
    ];
    for (const tabName of offlineTour) {
      await tabNav.open(tabName);
      await expect(tabNav.tabScreen(tabName)).toBeVisible();
    }

    // Reconnect: the app keeps working.
    await authedPage.context().setOffline(false);
    await tabNav.open('Friends');
    await expect(tabNav.tabScreen('Friends')).toBeVisible();
    await tabNav.open('Home');
    await expect(homePage.screen()).toBeVisible();
  });
});
