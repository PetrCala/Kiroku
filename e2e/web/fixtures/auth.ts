import {test as base, expect, type Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {LoginPage} from '../pages/LoginPage';
import {HomePage} from '../pages/HomePage';

/**
 * Where the cached signed-in session is stored. This file holds a live auth
 * token (Onyx persists it in IndexedDB on web), so it is git-ignored.
 */
const STORAGE_STATE = path.resolve(__dirname, '..', '.auth', 'user.json');

const E2E_TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

type AuthFixtures = {
  /** A page already signed in via the cached storage state. */
  authedPage: Page;
};

type AuthWorkerFixtures = {
  /** Path to the storage-state file, produced once per worker. */
  workerStorageState: string;
};

/**
 * Test harness that signs in once per worker and reuses the resulting session.
 *
 * - `page` (built-in) stays logged out -- use it to exercise the sign-in flow.
 * - `authedPage` starts already authenticated -- use it for everything else.
 */
export const test = base.extend<AuthFixtures, AuthWorkerFixtures>({
  // Log in a single time per worker and cache the full storage state
  // (cookies + localStorage + IndexedDB, where the Onyx auth token lives).
  workerStorageState: [
    async ({browser}, use) => {
      if (fs.existsSync(STORAGE_STATE)) {
        await use(STORAGE_STATE);
        return;
      }

      if (!E2E_TEST_EMAIL || !E2E_TEST_PASSWORD) {
        throw new Error(
          'E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set. Copy e2e/web/.env.e2e.example to e2e/web/.env.e2e (local) or provide them as CI secrets.',
        );
      }

      const context = await browser.newContext();
      const page = await context.newPage();
      const loginPage = new LoginPage(page);
      const homePage = new HomePage(page);

      await loginPage.goto();
      await loginPage.signIn(E2E_TEST_EMAIL, E2E_TEST_PASSWORD);
      // Only snapshot the session once the authenticated shell is up.
      await homePage.waitUntilVisible();

      fs.mkdirSync(path.dirname(STORAGE_STATE), {recursive: true});
      await context.storageState({path: STORAGE_STATE, indexedDB: true});
      await context.close();

      await use(STORAGE_STATE);
    },
    {scope: 'worker'},
  ],

  authedPage: async ({browser, workerStorageState}, use) => {
    const context = await browser.newContext({
      storageState: workerStorageState,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export {expect};
