import type {Page} from '@playwright/test';

/**
 * Drive the app from just-after-sign-in (or a fresh authenticated page load) to
 * the Home screen, clearing the dev-build gates that can sit in between:
 *
 *   - the **email-verification** screen. Dev/staging/adhoc builds expose a
 *     "Skip verification (dev only)" action; for an unverified account this gate
 *     is re-shown on every fresh load, so authenticated navigations need to
 *     clear it too (not just sign-in).
 *   - the **updated terms-of-service** consent sheet (checkbox + "Confirm").
 *     This is the post-onboarding `TermsReConsentGuard`, which `SKIP_ONBOARDING`
 *     does *not* bypass, so it can appear even on the E2E build.
 *
 * Both are best-effort: an already-verified account that has accepted the
 * current terms goes straight to Home and the loop exits on the first check.
 * The suite runs against the dev/staging build (`npm run web`, preview channel),
 * where the skip action exists; on a production build it would not, and a
 * verified account would not see the gate at all.
 *
 * If Home never appears, dump the page URL + ARIA snapshot to stdout before
 * failing. CI artifacts (screenshots/traces) are not always reachable, so the
 * job log is the only place this state is guaranteed to surface — the snapshot
 * names whatever screen we got stuck on (e.g. a sign-in form still showing a
 * server/validation error means authentication never actually completed).
 */
export async function reachAuthenticatedApp(page: Page): Promise<void> {
  const home = page.getByTestId('Home Screen');
  const skipVerification = page.getByRole('button', {
    name: 'Skip verification (dev only)',
  });
  const confirmTerms = page.getByRole('button', {name: 'Confirm'});
  const agreeToTerms = page.getByRole('checkbox').first();

  // A couple of gates can stack between sign-in and Home; clear whatever is up
  // until Home renders (or we run out of attempts and dump + assert below).
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
    }

    // Wait for the next screen (Home or another gate) to mount before retrying.
    await home
      .or(skipVerification)
      .or(confirmTerms)
      .first()
      .waitFor({state: 'visible', timeout: 8000})
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
 * (verify-email, force-update, terms) apart from a still-logged-out sign-in
 * form (which means authentication never completed) or a NotFound / loading
 * screen.
 */
async function dumpStuckPageState(page: Page): Promise<void> {
  /* eslint-disable no-console */
  try {
    console.log(`[reachAuthenticatedApp] stuck — URL: ${page.url()}`);
    // If we're still on the sign-in form, the email field's value tells us
    // whether Playwright's fill() actually reached the FormProvider-backed
    // input (empty -> fill never registered -> validation blocked submit;
    // populated -> the failure is credentials / a server error instead).
    const emailValue = await page
      .locator('input[aria-label="Email"]')
      .inputValue()
      .catch(() => '<no email input on page>');
    console.log(`[reachAuthenticatedApp] email input value: "${emailValue}"`);
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
