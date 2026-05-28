/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention */
import fs from 'fs';
import path from 'path';
import CONST from '@src/CONST';

const CONTEXT_DIR = path.resolve(__dirname, '../../src/languages/context');

// Every supported non-English locale must ship a translation context file
// (glossary + style guide). This is what keeps AI- and human-authored
// translations unified. The `translate` skill refuses to translate a language
// that has no context file, so this test enforces the same contract in CI.
const localesNeedingContext = Array.from(
  new Set(
    Object.entries(CONST.LOCALES)
      .filter(([key]) => key !== 'DEFAULT')
      .map(([, value]) => value)
      .filter(locale => locale !== CONST.LOCALES.EN),
  ),
);

describe('Translation context files', () => {
  it.each(localesNeedingContext)('locale "%s" has a context file', locale => {
    const contextFile = path.join(CONTEXT_DIR, `${locale}.md`);
    const exists = fs.existsSync(contextFile);
    if (!exists) {
      console.debug(
        `🏹 Missing translation context: src/languages/context/${locale}.md — copy _TEMPLATE.md and fill it in.`,
      );
    }
    expect(exists).toBe(true);
  });

  it('context files are non-trivial (not left as empty placeholders)', () => {
    localesNeedingContext.forEach(locale => {
      const contextFile = path.join(CONTEXT_DIR, `${locale}.md`);
      if (!fs.existsSync(contextFile)) {
        return;
      }
      const contents = fs.readFileSync(contextFile, 'utf8');
      expect(contents.length).toBeGreaterThan(500);
    });
  });
});
