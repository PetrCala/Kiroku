import type {ConsoleMessage, Page} from '@playwright/test';

/**
 * Console noise that is known-benign on web and not worth failing a smoke run
 * over (see the #934 web QA pass). Everything else counts as a real error.
 *
 * The preview channel and `npm run web` both use webpack `mode: 'development'`
 * (build-web-dev), so React dev warnings are present. Production builds
 * (build-web) strip them automatically, but the filter is harmless there too.
 */
export const BENIGN_CONSOLE_PATTERNS = [
  'pointerEvents is deprecated',
  'props.pointerEvents is deprecated',
  '"shadow*" style props are deprecated',
  'Download the React DevTools',
  // React 19 dev warning emitted for any code that still accesses element.ref
  // (common in third-party libs not yet updated for React 19). Not actionable
  // in a smoke run.
  'Accessing element.ref was removed in React 19',
];

export function isBenign(text: string): boolean {
  return BENIGN_CONSOLE_PATTERNS.some(pattern => text.includes(pattern));
}

/**
 * Start collecting genuine console errors and uncaught page errors. Attach this
 * before navigating so boot-time errors are captured too. Returns the live
 * array, which fills as the page runs.
 */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error' && !isBenign(message.text())) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error: Error) => {
    errors.push(error.message);
  });
  return errors;
}
