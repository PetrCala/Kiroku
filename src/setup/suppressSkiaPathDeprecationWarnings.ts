/**
 * TEMPORARY dev-only filter for `react-native-skia` path-construction
 * deprecation warnings emitted from inside `victory-native`.
 *
 * `victory-native`'s CartesianChart primitives (Line, Bar, Frame, useLinePath,
 * useBarPath, ...) still build paths with the deprecated `SkPath.addPath()/
 * addRect()/addRRect()` APIs. As of victory-native 41.21.0 (latest, 2026-05)
 * they haven't migrated to `Skia.PathBuilder`, so there's no upstream fix to
 * pull in and we can't edit the package. The warnings are dev-only and
 * harmless in production, but they spam the console on every chart render.
 *
 * Our own charts (HourPolar, DrinkTypeDonut) already use `PathBuilder`, so the
 * only remaining offenders are upstream. The filter targets exactly the
 * path-migration deprecation family (matched via the guide URL skia embeds in
 * the message) and nothing else.
 *
 * REMOVAL: delete this file and its single call in `src/setup/index.ts` once
 * victory-native ships a release built on `Skia.PathBuilder`. See the note in
 * `src/components/Charts/BaseChart/BaseChart.tsx`.
 */

const SKIA_PATH_DEPRECATION_MARKERS = [
  '[react-native-skia]',
  'path-migration',
] as const;

function isSkiaPathDeprecationWarning(args: unknown[]): boolean {
  const [first] = args;
  return (
    typeof first === 'string' &&
    SKIA_PATH_DEPRECATION_MARKERS.every(marker => first.includes(marker))
  );
}

export default function suppressSkiaPathDeprecationWarnings(): void {
  if (!__DEV__) {
    return;
  }

  // eslint-disable-next-line no-console
  const originalWarn = console.warn.bind(console);
  // eslint-disable-next-line no-console
  console.warn = (...args: unknown[]) => {
    if (isSkiaPathDeprecationWarning(args)) {
      return;
    }
    originalWarn(...args);
  };
}
