# Kiroku

## Repository Overview

### Technology Stack

- **Framework**: React Native
- **Language**: TypeScript
- **State Management**: React Native Onyx
- **Navigation**: React Navigation
- **Platforms**: iOS, Android, Web

## Core Architecture & Structure

### Entry Points

- `src/App.tsx`: Main application component with provider hierarchy
- `src/Kiroku.tsx`: Core application logic and initialization
- `index.js`: React Native entry point

### Provider Architecture

The application uses a nested provider structure for context management:

1. **SplashScreenStateContextProvider**: Manages splash screen visibility
2. **InitialURLContextProvider**: Handles deep linking
3. **ThemeProvider**: Theme management
4. **LocaleContextProvider**: Internationalization

### Data Layer

- **Onyx**: Custom data persistence layer for offline-first functionality
- **ONYXKEYS.ts**: Centralized key definitions for data store
- Supports optimistic updates and conflict resolution

## Key Features & Modules

### Core Functionality

1. **Drinking Session Management**

   - Session creation, editing, and deletion
   - Real-time session tracking
   - Drink logging within sessions
   - Session notes

2. **Calendar & History**

   - Monthly calendar view of past sessions
   - Session history browsing
   - Paginated calendar data loading

3. **User Profile & Account**

   - Profile management (display name, username, legal name, date of birth)
   - Account settings and preferences
   - Account deletion flow

4. **Preferences**

   - Theme selection (light/dark mode)
   - App-wide preference persistence

5. **Notifications**

   - Push notification opt-in/out
   - Focus mode alerts

6. **Onboarding & Welcome**
   - First-run onboarding flow
   - Email verification

## Navigation & Routing

### Structure

- `src/SCREENS.ts`: Screen name constants
- `src/ROUTES.ts`: Route definitions and builders
- `src/NAVIGATORS.ts`: Navigator configuration

### Key Navigators

- **ProtectedScreens**: Authenticated app screens
- **PublicScreens**: Login and onboarding screens
- **RHP (Right Hand Panel/Pane)**: Settings and details panel
- **Central Pane**: Main content area
- **LHN (Left Hand Navigation)**: Unused currently
- **RHP**: Contextual panels and settings

## State Management

### Onyx Keys Organization

- **Auth & Session**: `CREDENTIALS`, `STASHED_CREDENTIALS`, `SESSION`, `HAS_CHECKED_AUTO_LOGIN`
- **User Data**: `USER`, `USER_DATA_LIST`, `USER_PRIVATE_DATA`, `USER_DATA_METADATA`, `USER_LOCATION`
- **Network & State**: `NETWORK`, `PERSISTED_REQUESTS`, `PERSISTED_ONGOING_REQUESTS`, `DEVICE_ID`
- **Session & Activity**: `ONGOING_SESSION_DATA`, `EDIT_SESSION_DATA`, `START_SESSION_GLOBAL_CREATE`, `SESSIONS_CALENDAR_MONTHS_LOADED`
- **UI & App State**: `MODAL`, `IS_LOADING_APP`, `APP_LOADING_TEXT`, `PREFERRED_THEME`
- **Updates & Notifications**: `UPDATE_AVAILABLE`, `UPDATE_REQUIRED`, `PUSH_NOTIFICATIONS_ENABLED`, `FOCUS_MODE_NOTIFICATION`
- **Forms**: Login, Sign Up, Close Account, Display Name, Username, Legal Name, DOB, Email, Password, Feedback, Bug Report, Session Date/Note
- **Collections**: `DRINKS`, `DRINKING_SESSION`, `FEEDBACK`, `BUG`, `DOWNLOAD`

### Action Modules (`src/libs/actions/`)

Major action categories:

- `App.ts`: Application lifecycle
- `User.ts`: User account operations
- `Session/`: Authentication and session token management
- `DrinkingSession.ts`: Drinking session CRUD and tracking
- `Calendar.ts`: Calendar data loading and pagination
- `UserData.ts`: User data synchronization
- `Profile.ts`: Profile updates
- `Preferences.ts`: User preference persistence
- `PushNotification.ts`: Push notification opt-in/out
- `Network.ts`: Network state management
- `Modal.ts`: Modal visibility state
- `FormActions.ts`: Form state management
- `Welcome.ts`: Onboarding flow
- `CloseAccount.ts`: Account deletion
- `AppUpdate/`: App update detection and prompting
- `OnyxUpdates.ts` / `OnyxUpdateManager/`: Onyx update processing
- `PersistedRequests.ts`: Offline request queue management

## Build & Deployment

### CI/CD Workflows

Key GitHub Actions workflows:

- `deploy.yml`: Production deployment
- `preDeploy.yml`: Staging deployment
- `testBuild.yml`: PR test builds
- `test.yml`: Unit tests
- `typecheck.yml`: TypeScript validation
- `lint.yml`: Code quality checks
- `claude-review.yml`: Claude Code automated PR review — **intentionally disabled** (costs ~$1–2/PR in API credits; trigger is `workflow_dispatch` only — do not change to `pull_request`)

## Related Repositories

### kiroku-api

- **Purpose**: Kiroku API repository
- Contains API logic and code

### kiroku-cli

- **Purpose**: Admin libraries and utilities
- Contains admin tools and utilities for high-level app management
- Private

## Development Practices

### React Native Best Practices

Use the `/react-native-best-practices` skill when working on performance-sensitive code, native modules, or release preparation. This ensures code respects established best practices from the start, resulting in more consistent code, fewer review iterations, and better resilience against regressions.

The skill provides guidance on:

- **Performance**: FPS optimization, virtualized lists (FlashList), memoization, atomic state, animations
- **Bundle & App Size**: Barrel imports, tree shaking, bundle analysis, R8 shrinking
- **Startup (TTI)**: Hermes bytecode optimization, native navigation, deferred work
- **Native Modules**: Turbo Module development, threading model, Swift/Kotlin/C++ patterns
- **Memory**: JS and native memory leak detection and patterns
- **Build Compliance**: Android 16KB page alignment (Google Play requirement)
- **Platform Tooling**: Xcode/Android Studio profiling and debugging setup

### Code Quality

- **TypeScript**: Strict mode enabled
- **ESLint**: Linter. Pre-existing violations are grandfathered via [`eslint-seatbelt`](https://github.com/justjake/eslint-seatbelt).
- **Prettier**: Code formatting - run `npm run prettier` after making changes
- **Patch Management**: patch-package for dependency fixes

### Avoiding `any` type violations

The rules `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-unsafe-assignment`, and `@typescript-eslint/no-unsafe-argument` are enforced as errors.

- Prefer proper types over `any`. When a cast to `any` or `ReactElement<any>` is genuinely necessary (e.g., for `cloneElement` with spread props), add the disable comment on the **preceding line**:
  ```ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cloneElement(child as React.ReactElement<any>, {...});
  ```
- Apply the comment consistently — if you add the same pattern in multiple places in a PR, every instance needs the comment.

### Module declarations with single named exports

If a `declare module` block uses a named export (required for module augmentation — default exports do not work in module declarations), suppress the `import/prefer-default-export` rule on the preceding line:

```ts
// eslint-disable-next-line import/prefer-default-export
export {getReactNativePersistence};
```

### Post-Edit Checklist (IMPORTANT)

**ALWAYS run these steps after making code changes, before committing:**

1. **Prettier**: Run `npx prettier --write <changed files>` on every file you modified. This is mandatory - CI will reject unformatted code.
2. **ESLint**: Run `npm run lint-changed` to catch fixable errors in changed files early. Then run `npm run lint` to validate exactly what CI will check — this is the required gate. Note that `lint-changed` uses `--fix` (auto-fixes files in place) and only covers your changed files, so it is NOT equivalent to CI.
3. **TypeScript**: Run `npm run typecheck-tsgo` after changes that may affect typing (types, interfaces, or function signatures). It is ~10x faster and usually stricter than tsc. CI validates with `npm run typecheck` (tsc), which remains the required merge gate.
4. **React Compiler**: If you added new React components/hooks or modified existing ones, run `npm run react-compiler-compliance-check check-changed` to verify they compile with React Compiler. This applies the same rules as CI: new components/hooks must compile, and existing compiled files must not regress. See `contributingGuides/REACT_COMPILER.md` for details and common fixes.
5. **Unused imports**: After removing a type parameter from a function call (e.g., `createNavigator<MyParamList>()` → `createNavigator()`), verify the removed type's import is also deleted if it is no longer used anywhere in the file.

### Testing

- **Unit Tests**: Jest with React Native Testing Library
- **Performance Tests**: Reassure framework

## Styling and Theming

The app uses a **two-tier color system**: a private hex palette and a public set of semantic theme tokens. Components must always consume the semantic tier — never raw hex, never the palette directly.

### Rules

- **Never write raw hex codes in components.** All colors come from `useTheme()`. Existing offenders in deprecated files are grandfathered, but new code must not add to them.
- **Never `import` from `@styles/theme` directly.** ESLint blocks this — always go through `const theme = useTheme()` (and `useThemeStyles()` for computed styles, `useStyleUtils()` for style helpers).
- **`#F5C400` (brand yellow) lives in 5 files** — `src/styles/theme/colors.ts :: yellowStrong` is the source of truth. After editing it, run `npm run sync-brand-colors` to propagate to Android XML, iOS storyboard, and the icon-generation script. Never edit the other four by hand.

### Architecture

| Tier         | File                                                                                                                  | Purpose                                                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — palette  | [`src/styles/theme/colors.ts`](src/styles/theme/colors.ts)                                                            | Raw hex values (`yellow*`, `red*`, `productLight100`–`900`, `productDark100`–`900`, `blue*`, etc.). Internal — never referenced by app code. |
| 2 — semantic | [`src/styles/theme/themes/light.ts`](src/styles/theme/themes/light.ts) + [`dark.ts`](src/styles/theme/themes/dark.ts) | Component-facing names mapped to palette entries. **This is what the rest of the app uses.**                                                 |
| Type         | [`src/styles/theme/types.ts`](src/styles/theme/types.ts)                                                              | `ThemeColors` interface — full list of valid token names.                                                                                    |

### Most-used semantic tokens

The active theme is accessed via `const theme = useTheme()`. Pick the most specific token that matches the intent — don't reach for `theme.appColor` when `theme.success` says what you mean.

**Backgrounds**

| Token             | Use for                                        | Don't use for                                |
| ----------------- | ---------------------------------------------- | -------------------------------------------- |
| `appBG`           | Full-screen / page background                  | Modals (`modalBackground`), cards (`cardBG`) |
| `splashBG`        | Splash screen background (brand yellow)        | Anything inside the running app              |
| `modalBackground` | Modal / sheet surface                          | Inline cards                                 |
| `cardBG`          | Card / tile surface                            | Full-screen backgrounds                      |
| `componentBG`     | Inputs, list items, default component surfaces | Cards (use `cardBG`)                         |
| `sidebar`         | LHN / sidebar surface                          | Generic backgrounds                          |
| `overlay`         | Backdrop behind modals / dimmed states         | Solid surfaces                               |
| `highlightBG`     | Selected / highlighted row                     | Hover state (`hoverComponentBG`)             |

**Text**

| Token             | Use for                                                             | Don't use for                                |
| ----------------- | ------------------------------------------------------------------- | -------------------------------------------- |
| `text`            | Default body / heading text                                         | Helper / caption text (`textSupporting`)     |
| `textSupporting`  | Captions, helper text, less-important copy                          | Body text                                    |
| `textLight`       | Text on dark surfaces (light theme: white; dark theme: stays light) | Body text on default bg                      |
| `textDark`        | Text on light surfaces regardless of active theme                   | Body text on default bg                      |
| `textReversed`    | Text on a surface that uses the opposite theme                      | Body text in normal contexts                 |
| `textError`       | Inline validation / error copy                                      | Generic dangerous-action text (use `danger`) |
| `placeholderText` | TextInput placeholders                                              | Disabled state text                          |
| `heading`         | Page / section titles                                               | Body text                                    |

**Brand & state**

| Token                                         | Use for                                        | Don't use for                                  |
| --------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| `appColor`                                    | Brand-yellow accent (icons, highlights)        | Buttons (`success` family for primary actions) |
| `success` / `successHover` / `successPressed` | Primary-action buttons, positive confirmations | Generic accents (use `appColor`)               |
| `warning`                                     | Caution states, warning banners                | Errors (use `danger`)                          |
| `danger` / `dangerHover` / `dangerPressed`    | Destructive actions, error banners             | Inline form errors (use `textError`)           |
| `link` / `linkHover`                          | Inline hyperlinks                              | Buttons (use `success` family)                 |
| `unreadIndicator`                             | Unread dots / badges                           | Generic notification color                     |

**Buttons & interactive**

| Token                                                     | Use for                                        | Don't use for                          |
| --------------------------------------------------------- | ---------------------------------------------- | -------------------------------------- |
| `buttonDefaultBG` / `buttonHoveredBG` / `buttonPressedBG` | Standard button states                         | Primary CTAs (use `success` family)    |
| `checkBox`                                                | Checkbox fill when checked                     | Radio buttons (no dedicated token yet) |
| `hoverComponentBG` / `activeComponentBG`                  | Hover and pressed states on generic components | Buttons (use the `button*` family)     |

**Borders & dividers**

| Token           | Use for                         | Don't use for                 |
| --------------- | ------------------------------- | ----------------------------- |
| `border`        | Default 1px borders, dividers   | Focus rings (`borderFocus`)   |
| `borderLighter` | Subtle dividers inside cards    | Outer card borders (`border`) |
| `borderFocus`   | Focus-ring color (brand yellow) | Default borders               |

**Icons**

| Token          | Use for                                                             | Don't use for                  |
| -------------- | ------------------------------------------------------------------- | ------------------------------ |
| `icon`         | Default UI icon color                                               | Menu icons (`iconMenu`)        |
| `iconHovered`  | Icon hover state                                                    | Default state (`icon`)         |
| `iconMenu`     | Navigation menu icons (brand-tinted)                                | Inline content icons (`icon`)  |
| `iconReversed` | Icon on a reversed-theme surface                                    | Default contexts               |
| `appLogo`      | Tint passed to `<KirokuLogo />` / `<ImageSVG />` for the brand mark | Generic icon coloring (`icon`) |

**Layout / misc**

| Token         | Use for                                                 | Don't use for                              |
| ------------- | ------------------------------------------------------- | ------------------------------------------ |
| `spinner`     | ActivityIndicator color                                 | Generic accent color                       |
| `shadow`      | Shadow color on cards / modals                          | Borders                                    |
| `transparent` | Transparent backgrounds                                 | Layered transparency (use rgba in palette) |
| `inverse`     | Surface that flips light/dark relative to current theme | Permanent dark surface (use palette)       |

### Quick reference

- **Active theme:** `const theme = useTheme()` → `theme.<token>` (typed by `ThemeColors`)
- **Computed styles:** `const styles = useThemeStyles()` → `styles.<helper>`
- **Style utilities:** `const StyleUtils = useStyleUtils()` → `StyleUtils.<fn>(...)`
- **Adding a new semantic token:** add the key to [`types.ts`](src/styles/theme/types.ts), then provide its value in both [`light.ts`](src/styles/theme/themes/light.ts) and [`dark.ts`](src/styles/theme/themes/dark.ts). Don't add new raw hex; reference an existing palette entry.

## Special Considerations

### Offline-First Architecture

- All features work offline
- Optimistic updates with rollback
- Queue-based request handling
- Conflict resolution strategies

### Mobile-Specific Notes

- Push notifications via Pusher (`pusher-js`)
- Image picker and camera access via `expo-image-picker` and `react-native-permissions`
- Image processing via `expo-image-manipulator`
- Local SQLite database via `react-native-nitro-sqlite`
- Device info via `react-native-device-info`

### Security

- Firebase Authentication as primary auth provider (email/password and Google Sign-In)
- Encrypted auth token storage (`encryptedAuthToken`) persisted in Onyx
- Session tokens treated as opaque credentials — no client-side JWT parsing
- Runtime permissions managed via `react-native-permissions`

## Command Reference

### Common Tasks

```bash
# Install dependencies
npm install

# Clean build artifacts
npm run clean

# Type checking (tsgo, fast, for development only)
npm run typecheck-tsgo

# Type checking (tsc, CI production gate)
npm run typecheck

# Linting
npm run lint

# Format code with Prettier
npm run prettier

# Testing
npm run test
```

### Platform Builds

```bash
# iOS build
npm run ios

# Android build
npm run android

# Web build
npm run web
```

### iOS dev tooling — `xUnique`

The Podfile's `post_install` hook runs [`xUnique`](https://github.com/truebit/xUnique) after every `pod install` to keep `ios/kiroku.xcodeproj/project.pbxproj` diffs deterministic (CocoaPods otherwise assigns fresh random UUIDs every run, producing hundreds of lines of meaningless churn).

Install once:

```bash
pip3 install --user xUnique
```

Then make sure the install location is on your `PATH` (e.g. `~/.local/bin` or `~/Library/Python/3.x/bin`). The post_install hook auto-discovers common locations; if it can't find `xunique`, it prints a warning and continues — the build still works, but the pbxproj will accumulate random-UUID noise on each `pod install` that you'll need to discard manually with `git checkout ios/kiroku.xcodeproj/project.pbxproj`.

## Architecture Decisions

### React Native New Architecture

- Fabric renderer enabled
- TurboModules for native module integration
- Hermes JavaScript engine

### State Management Choice

- Custom Onyx library for offline-first capabilities
- Optimistic updates as default pattern
- Centralized action layer for API calls
- Direct key-value storage with automatic persistence

### Navigation Strategy

- React Navigation for cross-platform consistency
- Custom navigation state management
- Deep linking support

## Known Integration Points

### With kiroku-api

- REST API communication via native `fetch` with FormData request bodies
- Middleware chain: `makeXHR() → middleware[] → HttpUtils.xhr()`
- Dynamic API root selection (staging vs. production) configured in `src/libs/ApiUtils.ts`
- Network connectivity monitored via `NetworkConnection.ts` (pings `api/Ping` for server availability)
- Offline request queue managed via `PersistedRequests.ts` — replayed on reconnection

### With Firebase

- Auth provider for email/password and Google Sign-In
- Session lifecycle managed in `src/libs/actions/Session/`
