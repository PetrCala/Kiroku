/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention */
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import * as translations from '@src/languages/translations';
import type {
  TranslationFlatObject,
  TranslationPaths,
} from '@src/languages/types';
import * as Localize from '@src/libs/Localize';
import asMutable from '@src/types/utils/asMutable';
import {arrayDifference} from '@libs/Utils';

const originalTranslations = {...translations};

asMutable(translations).default = {
  [CONST.LOCALES.EN]: translations.flattenObject({
    testKey1: 'English',
    testKey2: 'Test Word 2',
    testKey3: 'Test Word 3',
    testKeyGroup: {
      testFunction: ({testVariable}) => `With variable ${testVariable}`,
    },
  }),
  [CONST.LOCALES.CS_CZ]: translations.flattenObject({
    testKey1: 'Czech',
    testKey2: 'Czech Word 2',
  }),
};

describe('translate', () => {
  it('Test present key in full locale', () => {
    expect(
      Localize.translate(CONST.LOCALES.CS_CZ, 'testKey1' as TranslationPaths),
    ).toBe('Czech');
  });

  it('Test when key is not found in full locale, but present in language', () => {
    expect(
      Localize.translate(CONST.LOCALES.CS_CZ, 'testKey2' as TranslationPaths),
    ).toBe('Czech Word 2');
  });

  it('Test when key is not found in full locale and language, but present in default', () => {
    expect(
      Localize.translate(CONST.LOCALES.CS_CZ, 'testKey3' as TranslationPaths),
    ).toBe('Test Word 3');
  });

  test('Test when key is not found in default', () => {
    expect(() =>
      Localize.translate(CONST.LOCALES.CS_CZ, 'testKey4' as TranslationPaths),
    ).toThrow(Error);
  });

  test('Test when key is not found in default (Production Mode)', () => {
    const ORIGINAL_IS_IN_PRODUCTION = CONFIG.IS_IN_PRODUCTION;
    asMutable(CONFIG).IS_IN_PRODUCTION = true;
    expect(
      Localize.translate(CONST.LOCALES.CS_CZ, 'testKey4' as TranslationPaths),
    ).toBe('testKey4');
    asMutable(CONFIG).IS_IN_PRODUCTION = ORIGINAL_IS_IN_PRODUCTION;
  });
});

/**
 * The shape of a flattened translation value. English is the source of truth,
 * so every locale must use the same shape for a given key (a plain string can
 * never silently replace an interpolation function or a string array). The
 * loose `satisfies TranslationBase` typing on the locale files does not catch
 * this, so we assert it here.
 */
function valueShape(value: unknown): 'string' | 'array' | 'function' | 'other' {
  if (typeof value === 'function') {
    return 'function';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'string') {
    return 'string';
  }
  return 'other';
}

/**
 * Flattened key paths whose value is *intentionally* identical to English in
 * every locale (brand names, format strings, universal abbreviations). These
 * are exempt from the "untranslated value" check below. Add a key here only
 * when the English text genuinely needs no translation — never to silence a
 * string that simply hasn't been translated yet.
 */
const UNTRANSLATED_ALLOWLIST = new Set<string>([
  // Brand / proper nouns & product names
  'common.google',
  'common.apple',
  'connectedAccounts.providers.google',
  'connectedAccounts.providers.apple',
  'supporter.tierName',
  'supporter.badgeAccessibilityLabel',
  'premiumFeatures.plusBadge',
  'bottomTabBar.menu',
  'onboarding.title',
  // Format / placeholder strings
  'common.dateFormat',
  'common.phoneNumberPlaceholder',
  'colorPaletteScreen.hex.placeholder',
  // Universal abbreviations (time, version, range)
  'common.am',
  'common.pm',
  'common.na',
  'timePeriods.abbreviated.second',
  'timePeriods.abbreviated.minute',
  'timePeriods.abbreviated.hour',
  'timePeriods.abbreviated.day',
  'timePeriods.abbreviated.month',
  'settingsScreen.aboutScreen.versionLetter',
  'statistics.filters.range.M',
  'statistics.filters.range.sixM',
  'testTools.override.auto',
  // Correct Czech happens to be identical to the English word
  'common.ok',
  'common.role',
  'statistics.tabs.trends.weeklyTrend.legend.trend',
  'errors.auth.networkRequestFailed.title',
  // "Blackout" kept as a loanword in Czech (casual register, used as a
  // severity-band label); see src/languages/context/cs_cz.md glossary.
  'common.blackout',
  'liveSessionScreen.blackout',
  'colorPaletteScreen.bands.black',
]);

describe('Translation Keys', () => {
  function traverseKeyPath(
    source: TranslationFlatObject,
    path?: string,
    keyPaths?: string[],
  ): string[] {
    const pathArray = keyPaths ?? [];
    const keyPath = path ? `${path}.` : '';
    (Object.keys(source) as Array<keyof TranslationFlatObject>).forEach(key => {
      if (
        typeof source[key] === 'object' &&
        typeof source[key] !== 'function'
      ) {
        // @ts-expect-error - We are modifying the translations object for testing purposes
        traverseKeyPath(source[key], keyPath + key, pathArray);
      } else {
        pathArray.push(keyPath + key);
      }
    });

    return pathArray;
  }

  // Exclude only the source-of-truth locale. Every other locale in
  // `CONST.LOCALES` is checked for full parity against English, so a feature PR
  // that adds English keys without translating them cannot merge green.
  const excludeLanguages = [CONST.LOCALES.EN];
  const languages = Object.keys(originalTranslations.default).filter(
    ln => !excludeLanguages.some(excludeLanguage => excludeLanguage === ln),
  );
  const mainLanguage = originalTranslations.default.en;
  const mainLanguageKeys = traverseKeyPath(mainLanguage);
  const mainLanguageFlat = mainLanguage as Record<string, unknown>;

  languages.forEach(ln => {
    const languageObject =
      originalTranslations.default[
        ln as keyof typeof originalTranslations.default
      ];
    const languageKeys = traverseKeyPath(languageObject);
    const languageFlat = languageObject as Record<string, unknown>;

    it(`Does ${ln} locale have all the keys`, () => {
      const hasAllKeys = arrayDifference(mainLanguageKeys, languageKeys);
      if (hasAllKeys.length) {
        console.debug(
          `🏹 [ ${hasAllKeys.join(', ')} ] are missing from ${ln}.js`,
        );
        Error(`🏹 [ ${hasAllKeys.join(', ')} ] are missing from ${ln}.js`);
      }
      expect(hasAllKeys).toEqual([]);
    });

    it(`Does ${ln} locale have unused keys`, () => {
      const hasAllKeys = arrayDifference(languageKeys, mainLanguageKeys);
      if (hasAllKeys.length) {
        console.debug(
          `🏹 [ ${hasAllKeys.join(', ')} ] are unused keys in ${ln}.js`,
        );
        Error(`🏹 [ ${hasAllKeys.join(', ')} ] are unused keys in ${ln}.js`);
      }
      expect(hasAllKeys).toEqual([]);
    });

    it(`Does ${ln} locale use the same value shape as en`, () => {
      const shapeMismatches = Object.keys(mainLanguageFlat).filter(key => {
        // Missing keys are already reported by the parity test above; only
        // compare keys the locale actually provides.
        if (!(key in languageFlat)) {
          return false;
        }
        return (
          valueShape(mainLanguageFlat[key]) !== valueShape(languageFlat[key])
        );
      });
      if (shapeMismatches.length) {
        console.debug(
          `🏹 [ ${shapeMismatches.join(', ')} ] have a different value shape in ${ln}.js than en.js (string vs function vs array)`,
        );
      }
      expect(shapeMismatches).toEqual([]);
    });

    it(`Does ${ln} locale have no untranslated (English) values`, () => {
      const untranslated = Object.keys(mainLanguageFlat).filter(key => {
        const enValue = mainLanguageFlat[key];
        const localeValue = languageFlat[key];
        // Only string leaves are checked. Functions/arrays are guarded by the
        // shape + parity tests; comparing their source is brittle.
        if (typeof enValue !== 'string' || typeof localeValue !== 'string') {
          return false;
        }
        if (UNTRANSLATED_ALLOWLIST.has(key)) {
          return false;
        }
        // A non-empty value identical to English is almost certainly a string
        // that was copied over but never translated.
        return enValue.trim().length > 0 && enValue === localeValue;
      });
      if (untranslated.length) {
        console.debug(
          `🏹 [ ${untranslated.join(', ')} ] are identical to en in ${ln}.js (likely untranslated). Translate them, or add the key to UNTRANSLATED_ALLOWLIST if the English text genuinely needs no translation.`,
        );
      }
      expect(untranslated).toEqual([]);
    });
  });
});

type ReportContentArgs = {content: string};

describe('flattenObject', () => {
  it('It should work correctly', () => {
    const func = ({content}: ReportContentArgs) =>
      `This is the content: ${content}`;
    const simpleObject = {
      common: {
        yes: 'Yes',
        no: 'No',
      },
      complex: {
        activity: {
          none: 'No Activity',
          some: 'Some Activity',
        },
        report: {
          title: {
            expense: 'Expense',
            task: 'Task',
          },
          description: {
            none: 'No description',
          },
          content: func,
          messages: ['Hello', 'Hi', 'Sup!'],
        },
      },
    };

    const result = translations.flattenObject(simpleObject);
    expect(result).toStrictEqual({
      'common.yes': 'Yes',
      'common.no': 'No',
      'complex.activity.none': 'No Activity',
      'complex.activity.some': 'Some Activity',
      'complex.report.title.expense': 'Expense',
      'complex.report.title.task': 'Task',
      'complex.report.description.none': 'No description',
      'complex.report.content': func,
      'complex.report.messages': ['Hello', 'Hi', 'Sup!'],
    });
  });
});
