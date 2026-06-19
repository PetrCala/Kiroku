import type {Locator, Page} from '@playwright/test';

/**
 * Page Object for the Friends (Social) tab. The screen hosts two inner tabs --
 * "Friend List" and "Friend Requests" -- in a `react-native-tab-view` pager.
 *
 * Actions and locators only -- assertions live in the specs.
 */
export class FriendsPage {
  constructor(private readonly page: Page) {}

  // The Social tab root (`SocialScreen.displayName`).
  screen(): Locator {
    return this.page.getByTestId('SocialScreen');
  }

  // Inner tab labels (`socialScreen.friendList` / `.friendRequests`). The pager
  // renders each label as a tab button; matching by accessible name keeps the
  // selector independent of the underlying tab-view DOM.
  friendListTab(): Locator {
    return this.page.getByRole('tab', {name: 'Friend List'});
  }

  friendRequestsTab(): Locator {
    return this.page.getByRole('tab', {name: 'Friend Requests'});
  }

  // The friend-list search field is always present on the Friend List tab
  // (placeholder = `friendListScreen.searchYourFriendList`), so it is a stable
  // signal that the tab's content rendered, regardless of how many friends the
  // account has.
  searchInput(): Locator {
    return this.page.getByPlaceholder('Search your friend list');
  }

  // Empty-state copy when the account has no friends
  // (`socialScreen.noFriendsYet`). One of this or a populated list is always the
  // resolved Friend List state.
  noFriendsInfo(): Locator {
    return this.page.getByText('You do not have any friends yet', {
      exact: true,
    });
  }

  /** Switch to the Friend Requests inner tab. */
  async openFriendRequestsTab(): Promise<void> {
    await this.friendRequestsTab().click();
  }
}
