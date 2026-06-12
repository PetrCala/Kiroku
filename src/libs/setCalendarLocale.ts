import type {Locale} from '@src/types/onyx';
import {LocaleConfig} from 'react-native-calendars';
import * as translations from '@src/languages/nonFlattenedTranslations';
import type {TranslationPaths} from '@src/languages/types';

/** Set a calendar locale to a desired locale value */
const setCalendarLocale = (locale: Locale) => {
  const translationsLocale = translations.default[locale];

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  LocaleConfig.locales[locale] =
    translationsLocale.calendar as TranslationPaths;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  LocaleConfig.defaultLocale = locale;
};

export default setCalendarLocale;
