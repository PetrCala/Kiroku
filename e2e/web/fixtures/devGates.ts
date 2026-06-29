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

  // Every gate interaction below is BOUNDED. A blind `.click()` inherits the
  // (90 s) test/fixture timeout, so when the verify-email modal overlays a Home
  // that is still settling on a cold boot, Playwright's actionability wait can
  // burn the whole budget on a single click — the cause of the first-attempt
  // sign-in flake (the fixture timed out mid-click even though Home had already
  // rendered). A short per-click budget fails fast and lets the loop re-try once
  // the page settles, then fall through to the Home check below. Home being up
  // is the real success signal; the gates are best-effort and re-cleared on
  // later loads (the worker session's auth token is already valid by then).
  const GATE_CLICK_TIMEOUT = 4_000;
  const GATE_DISMISS_TIMEOUT = 4_000;

  // A couple of gates can stack between sign-in and Home; clear whatever is up
  // until Home renders (or we run out of attempts and assert below).
  for (let attempt = 0; attempt < 6; attempt += 1) {
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
        await agreeToTerms.click({timeout: GATE_CLICK_TIMEOUT}).catch(() => {});
      }
      await confirmTerms.click({timeout: GATE_CLICK_TIMEOUT}).catch(() => {});
      // Converge on the gate actually clearing rather than racing the next
      // iteration; bounded so a click that didn't land just re-tries next pass.
      await confirmTerms
        .waitFor({state: 'hidden', timeout: GATE_DISMISS_TIMEOUT})
        .catch(() => {});
    } else if (await skipVerification.isVisible().catch(() => false)) {
      await skipVerification
        .click({timeout: GATE_CLICK_TIMEOUT})
        .catch(() => {});
      await skipVerification
        .waitFor({state: 'hidden', timeout: GATE_DISMISS_TIMEOUT})
        .catch(() => {});
    } else {
      // Neither a gate nor Home is up yet (cold first paint) — wait for the next
      // screen to mount before retrying.
      await home
        .or(skipVerification)
        .or(confirmTerms)
        .first()
        .waitFor({state: 'visible', timeout: 15_000})
        .catch(() => {});
    }
  }

  // Final assertion: Home being up is the real success signal — surfaces a clear
  // failure if it never came up.
  await home.waitFor({state: 'visible'});
}
