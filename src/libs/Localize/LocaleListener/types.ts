import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';

type BaseLocale = ValueOf<typeof CONST.LOCALES>;

type LocaleListenerConnect = (
  callbackAfterChange?: (locale?: BaseLocale) => void,
) => void;

type LocaleListener = {
  connect: LocaleListenerConnect;
};

export type {LocaleListenerConnect, LocaleListener};
export default BaseLocale;
