# CLAUDE.md

## Project overview

Kiroku is a cross-platform React Native (Expo) mobile app for tracking alcohol consumption. It targets iOS and Android, with Firebase used today for auth, realtime database, storage, and cloud functions.

## Migration status ⚠️

This repository is in active migration. Business logic is being moved to a separate API repository.

- Logic that has already been migrated: [TODO: fill in]
- Logic still in this repo that is scheduled for migration: [TODO: fill in — likely includes Firebase data access, database rules, cloud functions, and database migration/maintenance scripts referenced in the README]
- What stays here permanently: UI layer, navigation, device integrations

**Do not add new business logic to this repo. Do not deepen existing logic that is scheduled for migration. When in doubt, ask.**

## Repository structure

Top-level layout (only directories whose purpose is clear from the listing/README are described; the rest are marked TODO):

- `src/` — Application source (entry point is `src/App.tsx`, registered from root `index.js`)
- `android/` — Native Android project
- `ios/` — Native iOS project (CocoaPods)
- `assets/` — Static assets (images, fonts, etc.)
- `config/` — App configuration files [TODO: confirm contents]
- `desktop/` — Desktop-specific code [TODO: confirm — Electron?]
- `local/` — [TODO: describe]
- `scripts/` — Shell/TS scripts referenced by `package.json` (build, release, emulator setup, version bump, PR helpers, etc.)
- `fastlane/` — Fastlane configuration for iOS/Android release automation
- `patches/` — `patch-package` patches applied via `postinstall`
- `jest/` — Jest setup/helpers
- `__mocks__/` — Manual Jest mocks
- `__tests__/` — Tests (includes `integration/emulators` per `package.json`)
- `docs/` — Jekyll-based documentation site (`bun run docs`)
- `contributingGuides/` — Contribution documentation
- `workflow_tests/` — GitHub workflow tests (`npm run workflow-test`)
- `.github/` — GitHub Actions workflows and JS actions

Build/config files at the root: `app.json`, `babel.config.js`, `metro.config.js`, `react-native.config.js`, `rock.config.mjs`, `tsconfig.json`, `firebase.json`, `database.rules.json`, `storage.rules`, `Gemfile`, `.eslintrc.js`, `.prettierrc.js`.

## Commands

From `package.json` scripts:

**Run / dev**

- `npm start` — Start Metro bundler (`react-native start`)
- `npm run ios` — Build & run iOS (`scripts/run-build.sh --ios`)
- `npm run android` — Build & run Android (`scripts/run-build.sh --android`)
- `npm run startAndroidEmulator` — Launch Android emulator
- `npm run kill-metro` — Kill anything on port 8081

**Native housekeeping**

- `npm run ios:pod:install` — `pod install` in `ios/`
- `npm run ios:pod:reset` — Reset CocoaPods state
- `npm run gradle-clean` — `./gradlew clean` in `android/`

**Release builds**

- `npm run ios-build` / `npm run android-build` — Fastlane production builds
- `npm run jsbundle` — Generate iOS JS bundle + sourcemap
- `npm run symbolicate:ios` / `npm run symbolicate:android` — Symbolicate a stack trace
- `npm run symbolicate-release:ios` / `npm run symbolicate-release:android`
- `npm run bump` — Bump version

**Lint / format / typecheck**

- `npm run lint` — ESLint (errors only, cached)
- `npm run lint:changed` — ESLint --fix on files changed vs `master`
- `npm run lint:watch` — Watch mode
- `npm run lint:quiet` — Quiet lint
- `npm run prettier` — Prettier write
- `npm run prettier-watch` — Prettier on change
- `npm run build` — `tsc` typecheck

**Tests**

- `npm test` — Jest (`TZ=utc`)
- `npm run test:debug` — Jest with Node inspector
- `npm run test:emulators` — Run emulator-backed integration tests
- `npm run perf-test` — Reassure performance tests
- `npm run workflow-test` — GitHub Actions workflow tests

**Firebase**

- `npm run emulators` — Start Firebase emulators
- `npm run emulators-with-setup` — Setup + start emulators
- `npm run transpile` — `tsc --build functions`
- `npm run deploy-functions` — Deploy Firebase functions

**Misc / repo helpers**

- `npm run docs` — Serve Jekyll docs locally
- `npm run merge` / `npm run mergePR` / `npm run openPR` / `npm run pull-all`
- `npm run encrypt` — Encryption helper script
- `npm run gh-actions-build` / `npm run gh-actions-validate`
- `postinstall` runs `scripts/postInstall.sh` automatically after `npm install`

Note: The README recommends using **Bun** (`bun i`, `bun run …`) as the package manager.

## Tech stack

From `package.json`:

- **Runtime:** React Native `0.81.4`, React `19.1.0`, Expo `54.0.10`, React Native Web via `@expo/metro-runtime`
- **Build/tooling:** Metro, Babel (`@react-native/babel-preset`), TypeScript `5.9.x`, `babel-plugin-react-compiler`, Rock (`rock`, `@rock-js/*`), Fastlane, `patch-package`
- **Navigation:** `@react-navigation/native` 7, `@react-navigation/native-stack`, `@react-navigation/stack`
- **State / data:** `react-native-onyx`, `firebase` 10 (auth, realtime database, storage), `pusher-js`
- **Storage / persistence:** `@react-native-async-storage/async-storage`, `react-native-nitro-sqlite`, `react-native-quick-sqlite`, `react-native-fs`
- **UI / interaction:** `react-native-reanimated` 4, `react-native-gesture-handler`, `react-native-screens`, `react-native-safe-area-context`, `@shopify/flash-list`, `@gorhom/portal`, `react-native-modal`, `react-native-tab-view`, `react-native-pager-view`, `react-native-calendars`, `react-native-svg`, `react-native-linear-gradient`, `expo-image`, `react-content-loader`, `react-native-animatable`, `react-native-render-html`
- **Device / platform:** `react-native-device-info`, `react-native-permissions`, `react-native-haptic-feedback`, `react-native-localize`, `@react-native-community/netinfo`, `@react-native-community/slider`, `@react-native-clipboard/clipboard`, `expo-image-picker`, `expo-image-manipulator`, `react-native-webview`, `@react-native-google-signin/google-signin`
- **i18n / dates:** `@formatjs/intl-*`, `date-fns`, `date-fns-tz`
- **Utility:** `lodash`, `underscore`, `type-fest`, `semver`, `seedrandom`, `deep-diff`, `simply-deferred`, `ua-parser-js`, `yargs`
- **Testing:** Jest 29, `jest-expo`, `@testing-library/react-native`, `react-test-renderer`, `reassure`, `@firebase/rules-unit-testing`, `pusher-js-mock`, `memfs`, `jest-when`, `@ngneat/falso`
- **Linting:** ESLint 8 with `eslint-config-expensify`, `eslint-config-airbnb-typescript`, Prettier, plugins for React, React Native, React Hooks, React Compiler, JSX a11y, jsdoc, Storybook, testing-library, import-alias, `you-dont-need-lodash-underscore`

Node engine: `20.19.4`, npm `10.8.2` (per `engines`).

## Environment setup

No `.env.example` is checked into the repo. The repo contains env files per environment instead: `.env.development`, `.env.staging`, `.env.production`, `.env.adhoc` (their contents were not read here).

From the README, one documented variable is:

- `USE_EMULATORS=true` in `.env.development` — point the app at local Firebase emulators

Local setup (from README):

```bash
bundle update
bun i
bun -g i firebase-tools
brew install cmake   # required for Android compilation
cd ios && pod install
```

Android also requires a `android/local.properties` with `sdk.dir` and an `ANDROID_HOME` env var pointing at the Android SDK.

[TODO: enumerate the actual variables expected by the app once a canonical env example is established]

## What to avoid touching

- [TODO: list deprecated or legacy directories once known — candidates to verify: `local/`, `desktop/`, any in-repo Firebase data-access modules that are being migrated to the API repo]
- Any directory prefixed with `legacy/` or `old/`
- Native project files in `ios/` and `android/` — only edit when intentionally changing native config
- `patches/` — managed by `patch-package`; do not hand-edit without regenerating
- Generated/large artifacts at the root such as `main.jsbundle.map`, `tsconfig.tsbuildinfo`, `package-lock.json`, `bun.lockb` — do not edit manually
- Admin SDK JSON files (`kiroku-admin-sdk-*.json`) — secrets; never commit changes or new ones

## Conventions

- TypeScript: use strict types — **do not use `any`**
- Platform-specific file extensions (from README): default to `index.js`/`index.ts`; only split into `index.native.js`, `index.ios.js`, `index.android.js`, `index.website.js`, `index.desktop.js` when a feature is intrinsically tied to a platform. `index.native.js` must not coexist with `index.ios.js`/`index.android.js` in the same module.
- Formatting: Prettier for JS/TS/TSX, `shell-format` for bash scripts
- Linting: `npm run lint` must pass with zero warnings (`--max-warnings=0`)
- Path aliases like `@context/...` are used (see `src/App.tsx`) — prefer aliased imports over deep relative paths
- [TODO: fill in conventions for component structure, state management with Onyx, navigation patterns, and testing once working patterns are established]

## Known gotchas

- The repo standardizes on **Bun**, but `package.json` scripts and CI also work with npm; mixing package managers can desync `bun.lockb` and `package-lock.json`.
- `postinstall` runs `scripts/postInstall.sh` — installs may have side effects beyond fetching packages (e.g. applying patches).
- Android builds can fail with `Error: Command failed with EN0ENT` if `ANDROID_HOME` is unset (see README).
- `bun run build:android` may fail with a permissions error on `android/gradlew`; fix with `chmod +x ./android/gradlew`.
- iOS native deps must be reinstalled after dependency changes (`npm run ios:pod:install`; use `ios:pod:reset` if state is corrupted).
- Tests run with `TZ=utc` — time-sensitive code should not depend on the host timezone.
- Firebase database rules cascade for `.read`/`.write` but **`.validate` does not cascade** (see README "Working with Firebase").
- `expo.autolinking.exclude` in `package.json` opts out of autolinking for `expo-file-system`, `@react-native-google-signin/google-signin`, and `expo-keep-awake` — be aware when touching those integrations.
- React Compiler is enabled (`babel-plugin-react-compiler`) — avoid patterns that break its assumptions (mutating props/state outside setters, etc.).
- [TODO: add migration-specific gotchas as logic moves to the API repo — e.g. which client modules must call the API instead of Firebase directly]
