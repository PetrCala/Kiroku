/**
 * @jest-environment node
 *
 * The device timezone is not a value the platform promises to accept back.
 *
 * On Hermes/Apple, `Intl.DateTimeFormat().resolvedOptions().timeZone` can return
 * a name (e.g. "GMT") that is missing from the table Hermes validates the
 * `timeZone` option against, so feeding the resolved name straight back into a
 * formatter raises `RangeError: Invalid timeZoneName`. In a ReleaseProduction
 * build that killed the runtime ~1.5s into launch, before the first render, and
 * the app sat on the boot splash forever.
 *
 * Node's `Intl` is V8's and accepts "GMT" happily, so the Hermes behaviour is
 * reproduced here with a stub engine that mirrors it: a fixed known-names list,
 * a `RangeError` for anything outside it, and a resolver that hands back a name
 * the list does not contain.
 */

import {toZonedTime} from 'date-fns-tz';
import {resolveLocalParts} from '@libs/Statistics/localParts';
import {
  getDeviceTimezone,
  isValidTimezone,
  sanitizeTimezone,
} from '@libs/TimezoneUtils';
import type * as TimezoneUtilsModuleType from '@libs/TimezoneUtils';

/** Loaded fresh so the module's memoised validity/fallback state is per test. */
type TimezoneUtilsModule = typeof TimezoneUtilsModuleType;

const realDateTimeFormat = Intl.DateTimeFormat;

/**
 * Stand in for Hermes/Apple: `resolvedOptions()` reports `resolvedZone`, while
 * the `timeZone` option is accepted only when it is in `knownNames`. "UTC" and
 * "GMT" are in the list because they reach Apple's tables through
 * `NSTimeZone.abbreviationDictionary`; "Etc/UTC" is not, matching a real device.
 */
function installHermesLikeIntl(
  resolvedZone: string,
  knownNames: string[] = ['UTC', 'GMT', 'Europe/Prague', 'Africa/Abidjan'],
): void {
  const stub = function DateTimeFormat(
    _locales?: string | string[],
    options?: Intl.DateTimeFormatOptions,
  ) {
    const requested = options?.timeZone;
    if (requested !== undefined && !knownNames.includes(requested)) {
      throw new RangeError('Invalid timeZoneName');
    }
    return {
      resolvedOptions: () => ({timeZone: requested ?? resolvedZone}),
      formatToParts: () => [],
      format: () => '',
    };
  };
  Intl.DateTimeFormat = stub as unknown as typeof Intl.DateTimeFormat;
}

/** Import the module under the currently installed `Intl`. */
function loadFreshModule(): TimezoneUtilsModule {
  let loaded: TimezoneUtilsModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    loaded = require('@libs/TimezoneUtils') as TimezoneUtilsModule;
  });
  if (!loaded) {
    throw new Error('@libs/TimezoneUtils failed to load');
  }
  return loaded;
}

describe('TimezoneUtils', () => {
  afterEach(() => {
    Intl.DateTimeFormat = realDateTimeFormat;
  });

  describe('a resolved zone the engine will not accept back', () => {
    it('falls back instead of throwing when the device resolves to "GMT"', () => {
      // "GMT" resolves, but this engine rejects it as a `timeZone` option, which
      // is exactly the crash seen on the CI simulator.
      installHermesLikeIntl('GMT', ['UTC', 'Europe/Prague']);
      const TimezoneUtils = loadFreshModule();

      expect(() => TimezoneUtils.getDeviceTimezone()).not.toThrow();
      expect(TimezoneUtils.getDeviceTimezone()).toBe('UTC');
      expect(TimezoneUtils.isValidTimezone('GMT')).toBe(false);
    });

    it('picks the first fallback candidate the engine actually accepts', () => {
      // Apple's tables list neither "Etc/UTC" nor "UTC" here, so the probe has
      // to walk past both rather than trust the canonical spelling.
      installHermesLikeIntl('GMT', ['Africa/Abidjan']);

      expect(loadFreshModule().getDeviceTimezone()).toBe('Africa/Abidjan');
    });

    it('falls back when `resolvedOptions()` itself throws', () => {
      Intl.DateTimeFormat = function DateTimeFormat() {
        throw new RangeError('Invalid timeZoneName');
      } as unknown as typeof Intl.DateTimeFormat;

      // Nothing to fall back onto but the canonical name: the point is that the
      // resolver stays total, since `CONST` calls it at module scope.
      expect(() => loadFreshModule().getDeviceTimezone()).not.toThrow();
    });
  });

  describe('a zone the engine does accept', () => {
    it('passes a resolved IANA zone through unchanged', () => {
      installHermesLikeIntl('Europe/Prague');

      expect(loadFreshModule().getDeviceTimezone()).toBe('Europe/Prague');
    });

    it('passes valid IANA zones through `sanitizeTimezone` unchanged', () => {
      // Real `Intl` this time: these are ordinary zones, nothing to swap.
      expect(sanitizeTimezone('Asia/Tokyo')).toBe('Asia/Tokyo');
      expect(sanitizeTimezone('America/Los_Angeles')).toBe(
        'America/Los_Angeles',
      );
      expect(isValidTimezone('Australia/Eucla')).toBe(true);
    });

    it('always hands back a usable zone on the engine it runs on', () => {
      // This Jest environment's `Intl` reports no `timeZone` in
      // `resolvedOptions()` at all, which is the same class of gap as an
      // unaccepted name: whatever comes back has to be usable regardless.
      const resolved = getDeviceTimezone();

      expect(isValidTimezone(resolved)).toBe(true);
      expect(() => toZonedTime(0, resolved)).not.toThrow();
    });
  });

  describe('a garbage zone read back out of storage', () => {
    // A zone persisted by an older build, or synced from another device, is not
    // guaranteed to be usable here, so it is validated on read too.
    it.each(['Not/AZone', 'GMT+2', '', '   ', undefined, null, 42])(
      'rejects %p and hands back a usable zone instead',
      persisted => {
        expect(isValidTimezone(persisted)).toBe(false);

        const sanitized = sanitizeTimezone(persisted);
        expect(() => toZonedTime(0, sanitized)).not.toThrow();
        expect(Number.isNaN(toZonedTime(0, sanitized).getTime())).toBe(false);
      },
    );

    it('does not crash the date-formatting path a stored session goes through', () => {
      // `resolveLocalParts` is the shared resolver behind the calendar's day
      // bucketing and the stats engine, and it is handed `session.timezone`
      // verbatim. A bad zone must resolve at UTC+0, not take the screen down.
      const instant = Date.UTC(2024, 0, 15, 10, 0);

      expect(() => resolveLocalParts(instant, 'Not/AZone')).not.toThrow();
      expect(resolveLocalParts(instant, 'Not/AZone')).toMatchObject({
        localDay: '2024-01-15',
        localHour: 10,
      });
      // A good zone still resolves in its own offset, so the fallback has not
      // flattened everything to UTC.
      expect(resolveLocalParts(instant, 'Asia/Tokyo')).toMatchObject({
        localDay: '2024-01-15',
        localHour: 19,
      });
    });
  });
});
