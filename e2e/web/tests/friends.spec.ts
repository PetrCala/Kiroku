import {test, expect} from '../fixtures/auth';
import {HomePage} from '../pages/HomePage';
import {TabNav} from '../pages/TabNav';
import {FriendsPage} from '../pages/FriendsPage';
import {trackErrors} from '../fixtures/consoleErrors';

/**
 * The Friends tab is a recurring source of first-run/empty-state races (the
 * friends list once flashed "no friends" on a cold boot). These specs assert
 * the tab settles into a determinate, console-clean state and that its two
 * inner tabs are switchable -- independent of how many friends the dev test
 * account happens to have.
 */
test.describe('friends tab', () => {
  test('renders the friend list tab content', async ({authedPage}) => {
    const errors = trackErrors(authedPage);
    const homePage = new HomePage(authedPage);
    const tabNav = new TabNav(authedPage);
    const friends = new FriendsPage(authedPage);

    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();

    await tabNav.open('Friends');
    await expect(friends.screen()).toBeVisible();

    // The search field is always rendered on the Friend List tab, so it is a
    // stable signal the tab's content mounted (vs. spinning forever or flashing
    // an empty state) regardless of the account's friend count.
    await expect(friends.searchInput()).toBeVisible();

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual(
      [],
    );
  });

  test('switches to the Friend Requests tab', async ({authedPage}) => {
    const homePage = new HomePage(authedPage);
    const tabNav = new TabNav(authedPage);
    const friends = new FriendsPage(authedPage);

    await homePage.goto();
    await tabNav.open('Friends');
    await expect(friends.screen()).toBeVisible();
    await expect(friends.friendListTab()).toBeVisible();

    await friends.openFriendRequestsTab();
    await expect(friends.friendRequestsTab()).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
