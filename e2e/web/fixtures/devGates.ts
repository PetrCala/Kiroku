import type {Page} from '@playwright/test';

/**
 * Drive the app from just-after-sign-in (or a fresh authenticated page load) to
 * the Home screen, clearing whatever sits in between:
 *
 *   - the **stale `/auth` URL**. Sign-in happens on the public `/auth` route;
 *     once Firebase auth flips, the navigator swaps to the authenticated stack,
 *     which has *no* `/auth` route, so the app renders NotFound (not Home) until
 *     something navigates. `homePage.goto()` sidesteps this by loading `/`
 *     directly, but a bare `signIn()` leaves the URL on `/auth`. So if Home
 *     hasn't appeared and no gate is up, nudge the app to its root once.
 *   - the **email-verification** screen. Dev/staging/adhoc builds expose a
 *     "Skip verification (dev only)" action; for an unverified account this gate
 *     is re-shown on every fresh load, so authenticated navigations need to
 *     clear it too (not just sign-in).
 *   - the **updated terms-of-service** consent sheet (checkbox + "Confirm").
 *     This is the post-onboarding `TermsReConsentGuard`, which `SKIP_ONBOARDING`
 *     does *not* bypass, so it can appear even on the E2E build.
 *
 * All of these are best-effort: an already-verified account that has accepted
 * the current terms and is already on Home exits on the first check. The suite
 * runs against the dev/staging build (`npm run web`, preview channel), where the
 * skip action exists; on a production build it would not, and a verified account
 * would not see the gate at all.
 *
 * If Home never appears, dump the page URL + ARIA snapshot to stdout before
 * failing. CI artifacts (screenshots/traces) are not always reachable, so the
 * job log is the only place this state is guaranteed to surface — the snapshot
 * names whatever screen we got stuck on.
 */
export async function reachAuthenticatedApp(page: Page): Promise<void> {
  const home = page.getByTestId('Home Screen');
  const skipVerification = page.getByRole('button', {
    name: 'Skip verification (dev only)',
  });
  const confirmTerms = page.getByRole('button', {name: 'Confirm'});
  const agreeToTerms = page.getByRole('checkbox').first();

  // Only nudge to the app root once: a repeated reload loop would just burn the
  // fixture timeout if something other than the stale URL is keeping us off Home.
  let didNavigateToRoot = false;

  // Several gates can stack between sign-in and Home; clear whatever is up until
  // Home renders (or we run out of attempts and dump + assert below). Budget the
  // loop well under the test timeout so the diagnostics always get to print even
  // on the slow sign-in path (two ~8MB CanvasKit boots: /auth then the root).
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await home.isVisible().catch(() => false)) {
      return;
    }

    if (await confirmTerms.isVisible().catch(() => false)) {
      if (await agreeToTerms.isVisible().catch(() => false)) {
        await agreeToTerms.click().catch(() => {});
      }
      await confirmTerms.click().catch(() => {});
    } else if (await skipVerification.isVisible().catch(() => false)) {
      await skipVerification.click().catch(() => {});
    } else if (!didNavigateToRoot) {
      // No gate is up but Home still isn't here — most likely the URL is stuck
      // on `/auth` (NotFound under the authenticated stack). Resolve to the Home
      // tab by loading the app root.
      didNavigateToRoot = true;
      await page.goto('/').catch(() => {});
    }

    // Wait for the next screen (Home or another gate) to mount before retrying.
    await home
      .or(skipVerification)
      .or(confirmTerms)
      .first()
      .waitFor({state: 'visible', timeout: 6000})
      .catch(() => {});
  }

  if (await home.isVisible().catch(() => false)) {
    return;
  }

  await dumpStuckPageState(page);
  // Final assertion: surfaces a clear failure if Home never came up.
  await home.waitFor({state: 'visible'});
}

/**
 * Log where the app got stuck. The ARIA snapshot lists the roles + accessible
 * names of everything on screen, which is enough to tell a blocking modal
 * (verify-email, force-update, terms) apart from a NotFound / loading screen.
 */
async function dumpStuckPageState(page: Page): Promise<void> {
  /* eslint-disable no-console */
  try {
    console.log(`[reachAuthenticatedApp] stuck — URL: ${page.url()}`);
    const snapshot = await page
      .locator('body')
      .ariaSnapshot()
      .catch(() => '<aria snapshot unavailable>');
    console.log(`[reachAuthenticatedApp] ARIA snapshot:\n${snapshot}`);
  } catch (error) {
    console.log(
      `[reachAuthenticatedApp] failed to capture page state: ${String(error)}`,
    );
  }
  /* eslint-enable no-console */
}
