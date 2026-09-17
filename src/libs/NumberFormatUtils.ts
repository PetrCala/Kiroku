import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';
import LocaleUtils from './LocaleUtils';

function format(
  locale: ValueOf<typeof CONST.LOCALES>,
  number: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(
    LocaleUtils.getIntlLocale(locale),
    options,
  ).format(number);
}

function formatToParts(
  locale: ValueOf<typeof CONST.LOCALES>,
  number: number,
  options?: Intl.NumberFormatOptions,
): Intl.NumberFormatPart[] {
  return new Intl.NumberFormat(
    LocaleUtils.getIntlLocale(locale),
    options,
  ).formatToParts(number);
}

export {format, formatToParts};
