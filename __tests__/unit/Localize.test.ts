import Onyx from 'react-native-onyx';
import * as Localize from '@libs/Localize';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

// Czech binds the conjunction to the word that follows it with a non-breaking space.
const NBSP = '\u00a0';

const CASES: Array<[string[], string, string]> = [
  [[], '', ''],
  [['rory'], 'rory', 'rory'],
  [['rory', 'vit'], 'rory and vit', `rory a${NBSP}vit`],
  [['rory', 'vit', 'jules'], 'rory, vit, and jules', `rory, vit a${NBSP}jules`],
  [
    ['rory', 'vit', 'ionatan'],
    'rory, vit, and ionatan',
    `rory, vit a${NBSP}ionatan`,
  ],
];

/** The locale listener only reacts to truthy Onyx values, so reset it explicitly. */
function setLocale(locale: 'en' | 'cs_cz') {
  // eslint-disable-next-line rulesdir/prefer-actions-set-data
  return Onyx.set(ONYXKEYS.NVP_PREFERRED_LOCALE, locale);
}

describe('localize', () => {
  beforeAll(() => {
    Onyx.init({keys: {NVP_PREFERRED_LOCALE: ONYXKEYS.NVP_PREFERRED_LOCALE}});
  });

  afterAll(() => Onyx.clear());

  describe('formatList', () => {
    it.each(CASES)('formats %j in English', async (input, expected) => {
      await setLocale(CONST.LOCALES.EN);
      expect(Localize.formatList(input)).toBe(expected);
    });

    it.each(CASES)(
      'formats %j in Czech',
      async (input, _expectedEN, expectedCSCZ) => {
        await setLocale(CONST.LOCALES.CS_CZ);
        expect(Localize.formatList(input)).toBe(expectedCSCZ);
      },
    );
  });
});
