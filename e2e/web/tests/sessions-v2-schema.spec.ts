import {test, expect} from '../fixtures/auth';
import {HomePage} from '../pages/HomePage';
import {SessionPage} from '../pages/SessionPage';
import {trackErrors} from '../fixtures/consoleErrors';
import {hasE2EHooks} from '../fixtures/e2eHooks';

/**
 * Sessions v2 W1 (#1664): with the `SESSIONS_V2_SCHEMA` flag on, a new
 * session is written as schema 2 (a schema marker, a default name, friends
 * visibility) and its drinks as entries, and it still round-trips through
 * save, the summary and edit exactly like a legacy session. The flag ships ON
 * since W2 (#1665); the spec still sets it explicitly through the dev hooks,
 * so a remote override cannot make it pass by writing a legacy session
 * instead. It skips on builds without those hooks.
 */
type OngoingSessionLike = {
  schema_version?: number;
  name?: string;
  visibility?: string;
  drinks?: Record<string, unknown>;
  entries?: Record<string, {key: string; count: number; source: string}>;
};

test.describe('Sessions v2 schema flag', () => {
  test('writes a new session as schema 2 with entries and round-trips it', async ({
    authedPage,
  }) => {
    const errors = trackErrors(authedPage);
    const homePage = new HomePage(authedPage);
    const session = new SessionPage(authedPage);

    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();
    test.skip(
      !(await hasE2EHooks(authedPage)),
      'Needs a dev build (npm run web or a preview channel): the page hooks are __DEV__ only.',
    );
    await authedPage.evaluate(() => {
      window.kirokuE2E?.setFeatureFlag('SESSIONS_V2_SCHEMA', true);
    });

    await session.startLiveSession();
    const sessionId = session.currentSessionId();
    const unitsBefore = Number(await session.totalUnits().innerText());

    await session.logOneDrink();
    await expect
      .poll(async () => Number(await session.totalUnits().innerText()))
      .toBeGreaterThan(unitsBefore);

    // The live buffer holds a schema 2 session with one entry, no buckets.
    const ongoing = (await authedPage.evaluate(() =>
      window.kirokuE2E?.getOnyxValue('ongoingSessionData'),
    )) as OngoingSessionLike | undefined;
    expect(ongoing?.schema_version).toBe(2);
    expect(ongoing?.name).toMatch(/\S+ \S+/);
    expect(ongoing?.visibility).toBe('friends');
    expect(ongoing?.drinks).toBeUndefined();
    const entries = Object.values(ongoing?.entries ?? {});
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({count: 1, source: 'web'});

    const loggedUnits = await session.totalUnits().innerText();

    // Save, then re-open through the summary: the entries survive the
    // server round-trip and read back through the adapter.
    await session.save();
    await expect(authedPage).toHaveURL(
      new RegExp(`drinking-session/${sessionId}/summary`),
    );
    await session.openEditFromSummary();
    await expect(session.totalUnits()).toHaveText(loggedUnits);

    // Delete it. The tombstone path of a remove is covered by the unit
    // tests; on web the stepper's numeric input sits over the minus button.
    await session.discardAndConfirm();
    await expect(homePage.screen()).toBeVisible();
    await expect(session.editScreen()).toBeHidden();

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual(
      [],
    );
  });
});
