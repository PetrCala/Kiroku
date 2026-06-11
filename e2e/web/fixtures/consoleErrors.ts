import type {ConsoleMessage, Page} from '@playwright/test';

/**
 * Console noise that is known-benign on web and not worth failing a smoke run
 * over (see the #934 web QA pass). Everything else counts as a real error.
 */
export const BENIGN_CONSOLE_PATTERNS = [
  'pointerEvents is deprecated',
  'props.pointerEvents is deprecated',
  '"shadow*" style props are deprecated',
  'Download the React DevTools',
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
