import type {Locator, Page} from '@playwright/test';
import {reachAuthenticatedApp} from '../fixtures/devGates';

/**
 * Page Object for the email/password sign-in screen (`AuthScreen`).
 *
 * Actions and locators only -- assertions live in the specs.
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  // The email/password form lives at `/auth?mode=logIn`. The app defaults to
  // sign-up mode when no `mode` param is present, which applies password
  // complexity validation and prevents sign-in credentials from submitting.
  // `/auth` (the logged-out welcome screen) has only a "Create account" entry.
  async goto(): Promise<void> {
    await this.page.goto('/auth?mode=logIn');
  }

  // Target the `<input>` elements directly. react-native-web puts the
  // `aria-label` ("Email" / "Password") on BOTH the field's wrapper <div> and
  // the inner <input>, so `getByLabel` would match two nodes and trip strict
  // mode; the `input[aria-label=...]` selector resolves to exactly one. The
  // submit button renders the `common.logIn` string ("Log in").
  emailInput(): Locator {
    return this.page.locator('input[aria-label="Email"]');
  }

  passwordInput(): Locator {
    return this.page.locator('input[aria-label="Password"]');
  }

  submitButton(): Locator {
    return this.page.getByRole('button', {name: 'Log in'});
  }

  /**
   * Fill the credentials, submit, and land on Home. On a dev/staging build the
   * email-verification gate (and, for a stale agreement, the terms sheet) can
   * sit between sign-in and Home; clear them so the caller ends up on Home.
   */
  async signIn(email: string, password: string): Promise<void> {
    await this.emailInput().fill(email);
    await this.passwordInput().fill(password);
    await this.submitButton().click();
    await reachAuthenticatedApp(this.page);
  }
}
