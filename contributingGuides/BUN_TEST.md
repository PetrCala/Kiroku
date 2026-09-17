# Running the unit suite under `bun test`

**Status as of 2026-09-17 (bun 1.4.0 local, 1.4.2 latest): not viable. The suite stays on Jest.**

This document records what was actually measured, so the question can be
re-opened against evidence rather than re-investigated from scratch. If you are
here because "Bun is faster, why are we still on Jest", read
[Why the full port fails](#why-the-full-port-fails),
[Pre-transpiling Flow does not help](#pre-transpiling-flow-does-not-help-measured-2026-09-17)
and [What would change the answer](#what-would-change-the-answer).

## Reproducing this

```bash
node scripts/bun-test-triage.mjs
```

The script takes the file list from `jest --listTests`, so it cannot drift from
the real suite, runs every file under `bun test --isolate`, and sorts each file
into one of three buckets:

| bucket    | meaning                                      |
| --------- | -------------------------------------------- |
| `clean`   | passes under bun, no failures                |
| `failing` | loads under bun, but at least one test fails |
| `blocked` | throws before a single test runs             |

Useful flags: `--json <path>` to dump the full classification, `--list clean`
to print one bucket as plain paths, and `--run` to execute just the clean
bucket.

`--isolate` is not optional. Without it bun shares one module registry across
every test file and mocks leak between files, which produced a failure in our
own clean subset. With it, each file gets a fresh global and registry.

## Baseline

Jest, on this branch, 8-core macOS:

|                                   |                                   |
| --------------------------------- | --------------------------------- |
| Files                             | 150                               |
| Tests                             | 1334 (6 skipped)                  |
| Result                            | green, zero pre-existing failures |
| Cold wall time (no `.jest-cache`) | ~65 s                             |
| Warm wall time                    | ~10 s                             |

The 6 skipped tests are `__tests__/unit/Localize.test.ts`, disabled at the top
level with `xdescribe` pending a localize fix. That is unrelated to Bun.

## What bun can run today

| bucket  | files | share |
| ------- | ----- | ----- |
| clean   | 42    | 28%   |
| failing | 1     | 1%    |
| blocked | 107   | 71%   |

The 42 clean files are 347 tests, and they are the pure-logic ones: statistics,
string and color helpers, route builders, validation, git utilities. Exactly
one of them calls `jest.mock`. Across the whole suite, 65 files call
`jest.mock`, and essentially all of those are blocked.

So the portable subset is not a random 28%. It is precisely the set of tests
that neither mock a module nor transitively import `react-native`.

## Why the full port fails

Every blocked category reduces to the same root cause once you clear the one in
front of it. Bun uses its own transpiler and never runs Babel, and
`react-native`'s published source is Flow-typed JavaScript:

```
27 | import typeof * as ReactNativePublicAPI from './index.js.flow';
            ^
error: Unexpected typeof
    at node_modules/react-native/index.js:27:8
```

Jest gets past this because `babel.config.js` hands the test environment
`@react-native/babel-preset`, which strips Flow. Bun has no equivalent hook that
works. `Bun.plugin`'s `onLoad` does reach inside `node_modules`, but source
returned from a runtime loader that is CommonJS gets wrapped as ESM and never
evaluates ([oven-sh/bun#19279](https://github.com/oven-sh/bun/issues/19279),
open since 2025-04-25). That is precisely the shape of `react-native/index.js`.
The fix, [oven-sh/bun#34112](https://github.com/oven-sh/bun/pull/34112), is open
and unmerged.

Three findings make the "just add a shim" instinct a dead end:

1. **A DOM environment buys nothing.** Ten files fail with `window is not
defined`. Registering happy-dom through a `--preload` file (Bun's documented
   substitute for `testEnvironment: 'jsdom'`) fixes `window` on all ten, and
   every one of them then falls straight through to the Flow error. Running the
   entire suite with happy-dom moved the totals by six tests.
2. **`jest.mock` hoisting is dead upstream.** Bun does not hoist mock factories
   above imports. [oven-sh/bun#36297](https://github.com/oven-sh/bun/pull/36297),
   which would have added it, was **closed unmerged on 2026-09-13** in a stale-PR
   sweep. Nothing has replaced it. 65 of our 150 files depend on those
   semantics.
3. **`jest-expo` has no port.** The preset supplies the RN and Expo native-module
   mocks, transforms and globals that the suite is built on. Bun has no
   mechanism for a preset. The only community bridge,
   `bun-test-react-native`, requires Expo SDK 56+ and has a single maintainer
   and no meaningful adoption; we are on Expo 54.

Missing Jest APIs are a real but secondary cost. Bun implements none of
`requireActual` (6 files), `isolateModules` (3), `resetModules` (4),
`requireMock`, `mocked`, `doMock`, `unmock` or `createMockFromModule`, and none
of the async fake-timer variants. Bare automock, `jest.mock('x')` with no
factory, is also unsupported. `fakeTimers.enableGlobally` and its `doNotFake`
option, which `jest.config.js` sets globally, have no bunfig equivalent at all.

Those missing APIs are what the triage reports for the files that are not
blocked by Flow. They are the whole reason the `failing` bucket is nearly
empty: a file that calls `jest.resetModules()` in a `beforeEach` does not fail
a test, it throws before any test can run, so it lands in `blocked` too. The
one genuinely `failing` file, `__tests__/unit/libs/TimezoneUtils.test.ts`, runs
10 of its 14 tests and loses the 4 that need `jest.isolateModules`.

## Why we are not splitting the runner

Moving the 42 clean files to Bun and leaving the rest on Jest was evaluated and
rejected on the numbers.

A caveat on method: this was measured on a workstation running several other
jobs, where load average swung between 18 and 118 and the same command varied
20x in wall clock. CPU seconds (user + sys) are reported instead, because they
barely move under contention. Two interleaved rounds agreed to within 1 CPU
second on every row.

|                                     | CPU seconds |
| ----------------------------------- | ----------- |
| Jest, whole suite (150 files)       | ~184        |
| Jest, the 42 portable files         | ~30         |
| `bun test --isolate`, the 42 files  | ~3          |
| `bun test --parallel`, the 42 files | ~4          |

Bun really is about 10x cheaper per file, and that part of the Bun pitch holds
up. The problem is what the multiplier applies to. Those 42 files are 28% of
the suite, 26% of the tests, and only 16% of Jest's CPU, because the expensive
files are exactly the React Native ones Bun cannot load. Switching them over
takes total test CPU from ~184s to ~157s.

In wall clock on an unloaded machine the same split is worth roughly two
seconds: the whole Jest suite runs in ~10s warm, the 42 files account for ~4s
of that, and Bun does them in 2.6s isolated or 1.3s parallel.

For that, we would carry two test runners, two config surfaces, two CI paths,
and a standing risk that a file ends up running under neither. There is no
coverage argument either: all 42 already pass under Jest, so Bun would re-run
tests we have rather than add any.

The 26x speedup seen in `kiroku-cli` does not transfer. That was a plain Node
suite with no React Native in it.

## Pre-transpiling Flow does not help (measured 2026-09-17)

The obvious next move is to stop fighting Bun's transpiler and just remove the
Flow ahead of time: strip it out of `node_modules` into a mirror tree, point Bun
at the mirror, and see how many of the 107 blocked files come back. That was
tried. **It clears every Flow error and unblocks zero test files.**

### What was built

A throwaway mirror of the whole project root, hardlinked (not symlinked, because
Bun resolves modules from a file's realpath and a symlinked file resolves back
into the real tree). Inside it, every `.js` file carrying a Flow marker was
replaced with a Babel-stripped copy using the same three plugins the RN preset
uses for this: `@babel/plugin-transform-flow-strip-types`,
`babel-plugin-syntax-hermes-parser` and `babel-plugin-transform-flow-enums`.
Plain `flow-strip-types` on its own is not enough; it fails on 181 RN files that
use newer Flow syntax the Babel parser does not accept. With the Hermes parser
in front, 1,413 files strip cleanly and the only failures are Flow test fixtures
under `react-native/sdks/hermes/`, which nothing imports.

The scope was widened past the `transformIgnorePatterns` allowlist. The
allowlist covers 1,154 Flow files, but 259 more live in packages outside it
(`react-native-config` is the loudest), and those block tests just as hard.

`__DEV__` was defined in a `--preload`, matching what `jest.config.js` sets in
`globals`.

### Neither plugin hook works for this

`Bun.plugin`'s `onResolve` never fires in `bun test` on 1.4.0. A hook with a
`console.error` in it printed nothing and the import resolved to the real
`node_modules` anyway, with and without `--isolate`. So the documented way to
redirect a specifier is simply not available at test runtime.

The `onLoad` CJS bug ([oven-sh/bun#19279](https://github.com/oven-sh/bun/issues/19279))
never got the chance to bite, because the mirror serves real files from disk and
no loader hook is involved. Making the mirror the actual project root sidesteps
both problems.

### Result

| bucket  | before | after |
| ------- | ------ | ----- |
| clean   | 42     | 42    |
| failing | 1      | 2     |
| blocked | 107    | 106   |

One file moved, `__tests__/unit/reactNativeMock.test.ts`, and it moved from
`blocked` to `failing`. Of the other 106, 64 are blocked for a different reason
than before and 42 for the identical reason. Both Flow buckets went to zero:
`Unexpected typeof` 36 to 0, `Expected "from" but found "{"` 25 to 0.

Where those 61 formerly Flow-blocked files land now:

```
 31  undefined is not an object (evaluating 'TurboModuleRegistry.get')
 12  crashes with no attributable error line
  7  Cannot find module './index.shared'   (the @firebase/auth .d.ts resolution)
  4  undefined is not an object (evaluating 'language of languages')
  2  undefined is not an object (evaluating 'Platform.select')
  2  window is not defined
  1  Unexpected token '{'. import call expects one or two arguments
  1  undefined is not an object (evaluating 'ReactNativePlatform.OS')
  1  moved to the failing bucket
```

### The blocker behind Flow is worse than Flow

43 of those files (the 31 plus the 12 unattributed) are one root cause, and it is
not a missing mock. `react-native/index.js` is CommonJS that exports ~85 lazy
getters, so that importing `react-native` does not drag in the entire native
surface. Bun builds an ES module namespace for a CommonJS module by enumerating
`module.exports` eagerly, which fires every one of those getters at import time:

```
$ bun -e "import('react-native')"
ProgressBarAndroid has been extracted from react-native core ...
SafeAreaView has been deprecated ...
Invariant Violation: __fbBatchedBridgeConfig is not set, cannot invoke native modules
    at react-native/Libraries/BatchedBridge/NativeModules.js:187
    at react-native/Libraries/TurboModule/TurboModuleRegistry.js:15
    at react-native/Libraries/StyleSheet/StyleSheetExports.js:18
    at ActivityIndicator (react-native/index.js:35)
```

The deprecation warnings are the tell: the getters ran. And the namespace it
produces is wrong. `import {TurboModuleRegistry} from 'react-native'` yields
`undefined` while `require('react-native').TurboModuleRegistry` works, because
the getter values are not statically analyzable.

Under Jest this never arises: Babel compiles every consumer to CommonJS, so each
import is a property access that triggers exactly one getter on demand. Getting
the same behavior under Bun means running Babel over the whole graph, which is
the thing Bun was supposed to replace.

### Cost of the pre-transpile

On an 8-core machine under heavy load, so CPU seconds rather than wall clock:

| step                                                          | CPU seconds |
| ------------------------------------------------------------- | ----------- |
| hardlink the project root and `node_modules` into a mirror    | ~62         |
| strip Flow from the allowlist packages (15,491 files)         | ~13         |
| scan the other 51,618 `.js` files and strip the 259 Flow ones | ~20         |
| total                                                         | ~95         |

A whole Jest run is ~184 CPU seconds. The hardlink step is an artifact of this
particular mechanism and a real implementation might avoid it, but the ~33
seconds of scanning and stripping is inherent, and it would have to run on every
dependency change.

### What this changes

The earlier read was that [#34112](https://github.com/oven-sh/bun/pull/34112) is
the one upstream fix that matters, because nothing else helps while
`react-native` cannot be parsed. That is now measurably wrong. Parsing
`react-native` was never the binding constraint; it was just the first one. With
Flow gone, the suite is blocked on CommonJS-to-ESM namespace semantics, missing
`jest` APIs, absent native-module mocks and `jest-expo`, all at once, and no
single upstream fix moves any of them.

Treat the Flow question as settled. Do not spend time on a Flow-stripping
loader, a transformed-`node_modules` cache, or #34112.

## What would change the answer

Re-run `node scripts/bun-test-triage.mjs` when any of these lands, in roughly
this order of importance:

- Bun's CommonJS-to-ESM interop stops eagerly enumerating getters, or gains a
  documented way to opt out. This is the one that matters now; see
  [Pre-transpiling Flow does not help](#pre-transpiling-flow-does-not-help-measured-2026-09-17).
  [oven-sh/bun#34112](https://github.com/oven-sh/bun/pull/34112), the
  Flow-stripping loader fix, has been demoted: it was measured and it unblocks
  nothing on its own.
- `jest.mock` factory hoisting gets picked back up after
  [#36297](https://github.com/oven-sh/bun/pull/36297) was closed.
- `jest.requireActual` and friends appear. Tracked only as unchecked boxes in
  the umbrella issue [oven-sh/bun#1825](https://github.com/oven-sh/bun/issues/1825).
- We reach Expo SDK 56+, which is the floor for the one community RN bridge.

Two known Bun bugs to keep an eye on if we do retry:
[#39876](https://github.com/oven-sh/bun/issues/39876) (React Testing Library
tests hang on 1.4.x under both jsdom and happy-dom) and
[#43056](https://github.com/oven-sh/bun/issues/43056) (intermittent segfault at
exit under `--isolate`).

## Incidental findings

Two things turned up that are unrelated to Bun but worth knowing:

- **`__tests__/integration/` does not run.** `testMatch` in `jest.config.js`
  covers `__tests__/ui`, `__tests__/unit` and `__tests__/actions`, so the three
  files in `__tests__/integration/` (`Auth`, `Database`, `EmulatorData`) are
  matched by nothing and have not been executing. Two of them talk to the
  Firebase emulator, so this may well be deliberate, but it is not written down
  anywhere. Bun's default discovery does pick them up, which is how it surfaced.
- **`@firebase/auth` resolves to a `.d.ts` under Bun.** The package's `exports`
  map has a `react-native` condition whose `types` entry is
  `dist/rn/index.rn.d.ts`. Bun picks the type declaration instead of the
  `default` JavaScript entry and then fails on `Cannot find module
'./index.shared'`. This blocks 18 files independently of the Flow problem.
