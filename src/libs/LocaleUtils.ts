import type {TupleToUnion, ValueOf} from 'type-fest';
import CONST from '@src/CONST';

type AppLocale = ValueOf<typeof CONST.LOCALES>;

/**
 * App locales are stored with an underscore (e.g. `cs_cz`), which is not a valid
 * BCP 47 language tag. Intl constructors reject those outright, so every locale
 * value has to be mapped to its canonical tag before it reaches Intl.
 */
const INTL_LOCALES = {
  [CONST.LOCALES.EN]: 'en',
  [CONST.LOCALES.CS_CZ]: 'cs-CZ',
} as const satisfies Record<AppLocale, string>;

function getLanguageFromLocale(
  locale: AppLocale,
): TupleToUnion<typeof CONST.LANGUAGES> {
  switch (locale) {
    case CONST.LOCALES.CS_CZ:
      return CONST.LOCALES.CS_CZ;
    case CONST.LOCALES.EN:
      return CONST.LOCALES.EN;
    default:
      return CONST.LOCALES.DEFAULT;
  }
}

/**
 * Convert an app locale into the BCP 47 tag to hand to Intl.
 *
 * Unknown values fall back to the default locale rather than being passed
 * through, so a stale Onyx value can never make an Intl constructor throw.
 */
function getIntlLocale(locale: AppLocale): string {
  return INTL_LOCALES[locale] ?? INTL_LOCALES[CONST.LOCALES.DEFAULT];
}

export default {getLanguageFromLocale, getIntlLocale};
