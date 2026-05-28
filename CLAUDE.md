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

Keys are defined in `src/ONYXKEYS.ts`, grouped into:

- **Auth & Session**: Credentials and session state
- **User Data**: Profiles, private data, and location
- **Network & State**: Connectivity, persisted requests, device ID
- **Session & Activity**: Ongoing/edit drinking-session state and calendar pagination
- **UI & App State**: Modal, loading, and theme state
- **Updates & Notifications**: App-update and push-notification state
- **Forms**: Form state management
- **Collections**: Drinks, drinking sessions, feedback, bugs, downloads

### Action Modules (`src/libs/actions/`)

Major action categories:

- `App.ts`: Application lifecycle
- `Session/`: Authentication and session token management
- `DrinkingSession.ts`: Drinking session CRUD and tracking
- `Calendar.ts`: Calendar data loading and pagination
- `UserData.ts`: User data synchronization
- `User.ts`: User account operations
- `Profile.ts`: Profile updates
- `Preferences.ts`: User preference persistence

## Build & Deployment

### CI/CD Workflows

Key GitHub Actions workflows:

- `deploy.yml`: Production deployment
- `preDeploy.yml`: Staging deployment
- `testBuild.yml`: PR test builds
- `test.yml`: Unit tests
- `typecheck.yml`: TypeScript validation
- `lint.yml`: Code quality checks
- `claude-review.yml`: Automated PR review — **intentionally disabled** (manual `workflow_dispatch` only; do not switch to `pull_request`)
- `translation-review.yml`: Reviews translation PRs touching `src/languages/**`

## Related Repositories

### kiroku-api

- **Purpose**: Backend API — server-side logic and endpoints

### kiroku-cli

- **Purpose**: Admin tools and utilities (private)

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

### Localization & Translations

`src/languages/en.ts` is the source of truth; every other locale mirrors its key structure. Do **not** hand-write non-English translations in a feature PR — add English keys only, then fill other locales with the `translate` skill, which translates against each language's glossary in `src/languages/context/`. Every locale needs a context file (enforced by a unit test). PRs touching `src/languages/**` are auto-reviewed by the `translation-review` workflow.

### Code Quality

- **TypeScript**: Strict mode enabled
- **ESLint**: Linter. Pre-existing violations are grandfathered via [`eslint-seatbelt`](https://github.com/justjake/eslint-seatbelt).
- **Prettier**: Code formatting - run `npm run prettier` after making changes
- **Patch Management**: patch-package for dependency fixes
- **TypeScript / ESLint conventions**: Kiroku-specific rules (e.g. `any` handling, module declarations) live in [`contributingGuides/STYLE.md`](contributingGuides/STYLE.md).

### Post-Edit Checklist (IMPORTANT)

**ALWAYS run these steps after making code changes, before committing:**

1. **Prettier**: Run `npx prettier --write <changed files>` on every file you modified. This is mandatory - CI will reject unformatted code.
2. **ESLint**: Run `npm run lint-changed` (scoped to the git diff, auto-fixes). Do NOT run full-repo `npm run lint` locally — it takes ~10 minutes; the `lint.yml` CI workflow is the gate.
3. **TypeScript**: Run `npm run typecheck-tsgo` after changes that may affect typing (types, interfaces, or function signatures). It is ~10x faster and usually stricter than tsc. CI validates with `npm run typecheck` (tsc), which remains the required merge gate.
4. **React Compiler**: If you added new React components/hooks or modified existing ones, run `npm run react-compiler-compliance-check check-changed` to verify they compile with React Compiler. This applies the same rules as CI: new components/hooks must compile, and existing compiled files must not regress. See `contributingGuides/REACT_COMPILER.md` for details and common fixes.

### Testing

- **Unit Tests**: Jest with React Native Testing Library
- **Performance Tests**: Reassure framework

## Special Considerations

### Offline-First Architecture

- All features work offline
- Optimistic updates with rollback
- Queue-based request handling
- Conflict resolution strategies

### Mobile-Specific Notes

- Push notifications via Pusher
- Image picker, camera access, and image processing
- Local SQLite database for offline storage

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

- REST API communication over `fetch`
- Dynamic staging/production API root selection
- Offline request queue replayed on reconnection

### With Firebase

- Auth provider for email/password and Google Sign-In
- Session lifecycle managed in `src/libs/actions/Session/`
