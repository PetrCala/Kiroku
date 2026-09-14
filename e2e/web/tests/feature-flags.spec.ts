import type {Locator, Page} from '@playwright/test';
import {test, expect} from '../fixtures/auth';
import {HomePage} from '../pages/HomePage';
import {reachAuthenticatedApp} from '../fixtures/devGates';
import {trackErrors} from '../fixtures/consoleErrors';
import {
  emitConfigUpdate,
  overrideRemoteFeatureFlags,
  readPersistedFeatureFlags,
} from '../fixtures/featureFlags';

/**
 * Remote feature-flag overrides (`config.feature_flags`, see
 * contributingGuides/FEATURE_FLAGS.md). Overrides are injected into the
 * app-open response or a simulated `config` broadcast, never written to the
 * dev RTDB: its `config` node is global and shared by every dev user and test
 * run.
 *
 * Probed through the entry point gated by a flag: BADGES (default off), a
 * "Badges" button in the Home header, and one on the user's own Profile.
 *
 * Profile reads its flag through `useFeatureFlag`, so an override applies in
 * the running session. The Home header still reads `FeatureFlags.isEnabled`,
 * which doesn't re-render when an override arrives, so its Badges button
 * shows only from the next launch; that gap is pinned in the "known gap"
 * block below.
 */

// The Home calendar header renders the visible month as `MMM yyyy`
// (CONST.DATE.MONTH_YEAR_ABBR_FORMAT); it opens on the current month.
const monthLabel = new Date().toLocaleDateString('en-US', {
  month: 'short',
  year: 'numeric',
});

function calendarMonthText(page: Page): Locator {
  return page.getByText(monthLabel, {exact: true});
}

function badgesEntry(page: Page): Locator {
  return page.getByRole('button', {name: 'Badges', exact: true});
}

// How long an absent element has to stay absent. `toHaveCount(0)` passes the
// moment it's missing, so on its own it can't tell "hidden by the flag" from
// "not rendered yet"; holding it past a settle window catches a late re-render
// that brings it back.
const SETTLE_MS = 2_000;

async function expectStaysAbsent(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toHaveCount(0);
  await page.waitForTimeout(SETTLE_MS);
  await expect(locator).toHaveCount(0);
}

type RemoteFlags = Awaited<ReturnType<typeof overrideRemoteFeatureFlags>>;

/**
 * Boot Home with `flags` as the served overrides and wait until Onyx has stored
 * them and the calendar has rendered. Waiting for storage (not just the
 * response) matters: the app applies the app-open data asynchronously, so a
 * config broadcast sent any earlier would be overwritten by it.
 */
async function launchHome(
  page: Page,
  flags: Record<string, unknown>,
): Promise<RemoteFlags> {
  const remote = await overrideRemoteFeatureFlags(page, flags);
  const appOpened = remote.nextAppOpen();
  await new HomePage(page).goto();
  await appOpened;
  // The values really reach the app (Onyx drops null fields on write).
  await expectStoredOverrides(
    page,
    Object.fromEntries(
      Object.entries(flags).filter(([, value]) => value !== null),
    ),
  );
  await expect(calendarMonthText(page)).toBeVisible();
  return remote;
}

/** Reload the app, as a user relaunching it, and wait for Home again. */
async function relaunch(page: Page, remote: RemoteFlags): Promise<void> {
  const appOpened = remote.nextAppOpen();
  await page.reload();
  await reachAuthenticatedApp(page);
  await appOpened;
  await expect(calendarMonthText(page)).toBeVisible();
}

/** Wait until Onyx has persisted exactly `flags` as the config overrides. */
async function expectStoredOverrides(
  page: Page,
  flags: Record<string, unknown>,
): Promise<void> {
  await expect
    .poll(() => readPersistedFeatureFlags(page), {
      message: 'config.feature_flags persisted by Onyx',
    })
    .toEqual(flags);
}

test.describe('remote feature flags', () => {
  test('without overrides the compile-time default applies', async ({
    authedPage,
  }) => {
    const errors = trackErrors(authedPage);
    await launchHome(authedPage, {});

    await expectStaysAbsent(authedPage, badgesEntry(authedPage));

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual(
      [],
    );
  });

  test('BADGES: true turns the badges entry point on', async ({authedPage}) => {
    const errors = trackErrors(authedPage);
    const remote = await launchHome(authedPage, {BADGES: true});
    await relaunch(authedPage, remote);

    await expect(badgesEntry(authedPage)).toBeVisible();
    await badgesEntry(authedPage).click();
    await expect(authedPage.getByTestId('Badges Screen')).toBeVisible();

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual(
      [],
    );
  });

  // Only a real boolean overrides a flag.
  const nonBooleanCases: Array<{name: string; flags: Record<string, unknown>}> =
    [
      {name: 'the number 1', flags: {BADGES: 1}},
      {name: 'null', flags: {BADGES: null}},
      {name: 'the string "true"', flags: {BADGES: 'true'}},
    ];
  for (const {name, flags} of nonBooleanCases) {
    test(`non-boolean overrides (${name}) are ignored`, async ({
      authedPage,
    }) => {
      await launchHome(authedPage, flags);
      await expectStaysAbsent(authedPage, badgesEntry(authedPage));
    });
  }

  test('a config broadcast after load stores the override and applies it on relaunch', async ({
    authedPage,
  }) => {
    const remote = await launchHome(authedPage, {});

    // An admin PUT: the server holds the override (later app opens serve it)
    // and broadcasts the new config.
    const overrides = {BADGES: true};
    remote.set(overrides);
    await emitConfigUpdate(authedPage, {
      ...remote.lastServedConfig(),
      feature_flags: overrides,
    });
    await expectStoredOverrides(authedPage, overrides);

    await relaunch(authedPage, remote);
    await expect(badgesEntry(authedPage)).toBeVisible();

    // The admin DELETE: the override is cleared, the default is back.
    remote.set({});
    await emitConfigUpdate(authedPage, {
      ...remote.lastServedConfig(),
      feature_flags: {},
    });
    await expectStoredOverrides(authedPage, {});

    await relaunch(authedPage, remote);
    await expectStaysAbsent(authedPage, badgesEntry(authedPage));
  });

  // Profile reads BADGES through `useFeatureFlag`
  // (src/screens/Profile/ProfileScreen.tsx), so an override works in the
  // running session, whichever way it arrives.
  test('a config broadcast shows the Profile badges entry point and hides it again, without a relaunch', async ({
    authedPage,
  }) => {
    const errors = trackErrors(authedPage);
    const remote = await launchHome(authedPage, {});
    await new HomePage(authedPage).openOwnProfile();
    const profile = authedPage.getByTestId('Profile Screen').last();
    await expect(profile).toBeVisible();
    const profileBadges = profile.getByRole('button', {
      name: 'Badges',
      exact: true,
    });
    await expectStaysAbsent(authedPage, profileBadges);

    remote.set({BADGES: true});
    await emitConfigUpdate(authedPage, {
      ...remote.lastServedConfig(),
      feature_flags: {BADGES: true},
    });
    await expectStoredOverrides(authedPage, {BADGES: true});
    await expect(profileBadges).toBeVisible();
    await profileBadges.click();
    await expect(authedPage.getByTestId('Badges Screen')).toBeVisible();

    await authedPage.goBack();
    await expect(profile).toBeVisible();
    remote.set({});
    await emitConfigUpdate(authedPage, {
      ...remote.lastServedConfig(),
      feature_flags: {},
    });
    await expectStoredOverrides(authedPage, {});
    await expectStaysAbsent(authedPage, profileBadges);

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual(
      [],
    );
  });

  // Known gap: the Home header reads BADGES through `FeatureFlags.isEnabled`
  // (src/screens/HomeScreen.tsx), so an override that arrives while the app is
  // running (the boot app-open included) is stored but doesn't change the
  // screen until the next launch. Each test asserts the setup for real
  // (override served and stored) and then expects the screen to still be
  // stale. Once HomeScreen moves to `useFeatureFlag` these fail on that last
  // check: flip them to assert the change shows right away, as the Profile
  // spec above does.
  test.describe('BADGES without a relaunch (known gap)', () => {
    // Once Onyx has stored the override a subscribed component re-renders
    // within a frame, so a short budget is plenty.
    const IN_SESSION_TIMEOUT = 5_000;

    async function expectBadgesStillHidden(page: Page): Promise<void> {
      const shown = await expect(badgesEntry(page))
        .toBeVisible({timeout: IN_SESSION_TIMEOUT})
        .then(
          () => true,
          () => false,
        );
      expect(
        shown,
        'BADGES now shows without a relaunch: the known gap is fixed, so assert the change directly',
      ).toBe(false);
    }

    test('BADGES: true from the boot app-open shows the badges entry point only after a relaunch', async ({
      authedPage,
    }) => {
      await launchHome(authedPage, {BADGES: true});
      await expectBadgesStillHidden(authedPage);
    });

    test('BADGES: true from a config broadcast shows the badges entry point only after a relaunch', async ({
      authedPage,
    }) => {
      const remote = await launchHome(authedPage, {});
      remote.set({BADGES: true});
      await emitConfigUpdate(authedPage, {
        ...remote.lastServedConfig(),
        feature_flags: {BADGES: true},
      });
      await expectStoredOverrides(authedPage, {BADGES: true});
      await expectBadgesStillHidden(authedPage);
    });
  });
});
