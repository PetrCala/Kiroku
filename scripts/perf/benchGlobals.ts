/**
 * Side-effect import that defines the React Native `__DEV__` global before any
 * app source is loaded. `src/libs/Statistics/profiling.ts` references `__DEV__`
 * at module-evaluation time; under ts-node (the benchmark runner) that global
 * does not exist and would throw `ReferenceError`. Jest already injects
 * `__DEV__`, so the nullish guard leaves it untouched there.
 *
 * Import this FIRST, before importing anything under `@libs`/`@src`.
 */
const g = globalThis as Record<string, unknown>;
// eslint-disable-next-line no-underscore-dangle
g.__DEV__ ??= false;

export {};
