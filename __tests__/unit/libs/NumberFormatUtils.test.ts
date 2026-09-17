import CONST from '@src/CONST';
import LocaleUtils from '@libs/LocaleUtils';
import * as NumberFormatUtils from '@libs/NumberFormatUtils';

// Czech groups thousands with a non-breaking space and uses a comma for decimals.
const NBSP = ' ';

describe('LocaleUtils.getIntlLocale', () => {
  it('maps every app locale to a tag Intl accepts', () => {
    Object.values(CONST.LOCALES).forEach(locale => {
      const intlLocale = LocaleUtils.getIntlLocale(locale);
      expect(() => new Intl.NumberFormat(intlLocale)).not.toThrow();
      expect(intlLocale).not.toContain('_');
    });
  });

  it('converts the Czech locale to its BCP 47 tag', () => {
    expect(LocaleUtils.getIntlLocale(CONST.LOCALES.CS_CZ)).toBe('cs-CZ');
    expect(LocaleUtils.getIntlLocale(CONST.LOCALES.EN)).toBe('en');
  });
});

describe('NumberFormatUtils', () => {
  describe('format', () => {
    it('formats English numbers', () => {
      expect(NumberFormatUtils.format(CONST.LOCALES.EN, 1234567.89)).toBe(
        '1,234,567.89',
      );
    });

    it('formats Czech numbers with Czech separators', () => {
      expect(NumberFormatUtils.format(CONST.LOCALES.CS_CZ, 1234567.89)).toBe(
        `1${NBSP}234${NBSP}567,89`,
      );
    });
  });

  describe('formatToParts', () => {
    it('reports the Czech group and decimal separators', () => {
      const parts = NumberFormatUtils.formatToParts(
        CONST.LOCALES.CS_CZ,
        1000000.5,
      );

      expect(parts.find(part => part.type === 'group')?.value).toBe(NBSP);
      expect(parts.find(part => part.type === 'decimal')?.value).toBe(',');
    });
  });
});
