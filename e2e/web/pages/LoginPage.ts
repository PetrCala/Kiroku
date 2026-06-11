import type {Locator, Page} from '@playwright/test';

/**
 * Page Object for the email/password sign-in screen (`AuthScreen`).
 *
 * Actions and locators only -- assertions live in the specs.
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  /** Open the app root, which renders the sign-in screen when logged out. */
  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  // The form inputs expose `aria-label`s ("Email" / "Password") via
  // react-native-web; the submit button renders the `common.logIn` string.
  emailInput(): Locator {
    return this.page.getByLabel('Email', {exact: true});
  }

  passwordInput(): Locator {
    return this.page.getByLabel('Password', {exact: true});
  }

  submitButton(): Locator {
    return this.page.getByRole('button', {name: 'Log in'});
  }

  /** Fill the credentials and submit the sign-in form. */
  async signIn(email: string, password: string): Promise<void> {
    await this.emailInput().fill(email);
    await this.passwordInput().fill(password);
    await this.submitButton().click();
  }
}
