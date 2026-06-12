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
 *
 * Both are best-effort: an already-verified account that has accepted the
 * current terms goes straight to Home and the loop exits on the first check.
 * The suite runs against the dev/staging build (`npm run web`, preview channel),
 * where the skip action exists; on a production build it would not, and a
 * verified account would not see the gate at all.
 */
export async function reachAuthenticatedApp(page: Page): Promise<void> {
  const home = page.getByTestId('Home Screen');
  const skipVerification = page.getByRole('button', {
    name: 'Skip verification (dev only)',
  });
  const confirmTerms = page.getByRole('button', {name: 'Confirm'});
  const agreeToTerms = page.getByRole('checkbox').first();

  // A couple of gates can stack between sign-in and Home; clear whatever is up
  // until Home renders (or we run out of attempts and assert below).
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await home.isVisible().catch(() => false)) {
      // VerifyEmailModal can mount ~1 s after Home (fires after the Firebase auth
      // callback) and covers the NavigationRoot with a high z-index. Playwright's
      // isVisible() is z-index-blind, so Home looks reachable while the modal
      // swallows every click. Wait for the late-gate window, then check once more
      // before declaring success.
      await page.waitForTimeout(1500);
      const lateGateVisible =
        (await skipVerification.isVisible().catch(() => false)) ||
        (await confirmTerms.isVisible().catch(() => false));
      if (!lateGateVisible) {
        return;
      }
    }

    if (await confirmTerms.isVisible().catch(() => false)) {
      if (await agreeToTerms.isVisible().catch(() => false)) {
        await agreeToTerms.click();
      }
      await confirmTerms.click();
    } else if (await skipVerification.isVisible().catch(() => false)) {
      await skipVerification.click();
    }

    // Wait for the next screen (Home or another gate) to mount before retrying.
    await home
      .or(skipVerification)
      .or(confirmTerms)
      .first()
      .waitFor({state: 'visible', timeout: 15_000})
      .catch(() => {});
  }

  // Final assertion: surfaces a clear failure if Home never came up.
  await home.waitFor({state: 'visible'});
}
