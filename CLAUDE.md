# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kiroku is a React Native alcohol tracking app built with TypeScript, Firebase, and Expo. The app runs on iOS, Android, and web, with a focus on cross-platform compatibility while allowing platform-specific implementations when necessary.

## Essential Commands

### Development

- **Install dependencies**: `bun i` (preferred) or `npm ci`
- **Start Metro bundler**: `npm run start`
- **Run iOS**: `npm run ios` (runs on iPhone 16 Pro simulator in development mode)
- **Run Android**: `npm run android` (runs in development debug mode)
- **iOS pods**: `npm run ios:pod:install` or `npm run ios:pod:reset` (for issues)

### Testing

- **Run tests**: `npm test` (runs in UTC timezone)
- **Debug tests**: `npm run test:debug`
- **Test with Firebase emulators**: `npm run test:emulators` (requires emulators running)
- **Run emulators**: `npm run emulators` or `npm run emulators-with-setup`

### Linting and Formatting

- **Lint**: `npm run lint` (uses eslint-config-kiroku)
- **Lint changed files only**: `npm run lint:changed`
- **Format**: `npm run prettier`
- **Type check**: `npm run build` (runs TypeScript compiler)

### Builds

- **iOS production build**: `npm run ios-build` (generates .ipa file)
- **Android production build**: `npm run android-build` (generates APK)

## Architecture

### State Management

- **Onyx**: Primary state management solution (react-native-onyx). All persistent state is managed through Onyx keys defined in `ONYXKEYS.ts`
- Key state includes: user data, credentials, network status, drinking sessions, and more
- Use `useOnyx` hook for component subscriptions

### Data Layer

- **Firebase Realtime Database**: Primary backend for user data, drinking sessions, and social features
- **Database structure**: Managed with Firebase rules in `database.rules.json`
- **Database functions**: Located in `src/database/` (baseFunctions, friends, updates, protection, feedback)
- **Emulator support**: Set `USE_EMULATORS=true` in `.env.development` to use local Firebase emulators

### Navigation

- React Navigation (native-stack and stack navigators)
- Navigation utilities in `src/libs/Navigation/`
- Routes defined in `ROUTES.ts`, screens in `SCREENS.ts`, navigators in `NAVIGATORS.ts`

### Component Organization

- Components in `src/components/` are highly modular and reusable
- Use wrapper components instead of direct React Native imports (e.g., `@components/Pressable` instead of RN touchables, `@components/Text` instead of `react-native/Text`)
- Charts components in `src/components/Charts/` for data visualization
- Modal components for user flows (maintenance, updates, email verification, terms)

### Path Aliases

Always use TypeScript path aliases defined in `tsconfig.json`:

- `@components/*` → `./src/components/*`
- `@libs/*` → `./src/libs/*`
- `@hooks/*` → `./src/hooks/*`
- `@screens/*` → `./src/screens/*`
- `@src/*` → `./src/*`
- `@database/*` → `./src/database/*`
- `@styles/*` → `./src/styles/*`
- `@utils/*` → `src/utils/*`
- `@userActions/*` → `./src/libs/actions/*`
- `@analytics/*` → `src/libs/Analytics/*`
- `@auth/*` → `src/libs/auth/*`

### Platform-Specific Code

Use platform-specific file extensions when necessary:

- `.ios.tsx` / `.android.tsx` — Native app only (not mobile web)
- `.native.tsx` — Both iOS and Android native
- `.website.tsx` — Web only
- `index.js` — Default/shared implementation

### Configuration

- **Environment config**: Use `react-native-config` with `.env.development`, `.env.staging`, `.env.production`
- **App config**: `CONFIG.ts` handles environment-specific URLs, Firebase config, and feature flags
- **Constants**: `CONST.ts` contains app-wide constants (values, timezones, permissions, etc.)
- **Database paths**: `DBPATHS.ts` defines all Firebase database path structures
- **Errors**: `ERRORS.ts` contains error message constants

### Key Libraries

- `src/libs/actions/` — User actions and state mutations
- `src/libs/Analytics/` — Analytics tracking
- `src/libs/DataHandling.ts` — Core data manipulation utilities
- `src/libs/DateUtils.ts` — Date/time handling with timezone support
- `src/libs/UserUtils.ts` — User-related utilities

### Testing

- Jest with `jest-expo` preset
- Tests organized in `__tests__/` by type: `unit/`, `integration/`, `e2e/`, `actions/`
- Mocks in `__mocks__/` and setup in `jest/`
- Use `@testing-library/react-native` for component testing
- Firebase Rules Unit Testing available via `@firebase/rules-unit-testing`

## CI/CD & Deployment

### Workflow Overview

The project uses a sophisticated staging → production deployment cycle:

1. PRs merge to `master` trigger `preDeploy.yml`
2. Code deploys to `staging` branch (unless locked)
3. QA testing happens on staging with `StagingDeployCash` issues
4. Closing `StagingDeployCash` triggers production deploy via `finishReleaseCycle.yml`
5. Platform builds run via `platformDeploy.yml` (iOS and Android)

### Key Workflows

- `preDeploy.yml` — Runs on merge to master, creates new version, updates staging
- `deploy.yml` — Creates tags for staging, GitHub releases for production
- `platformDeploy.yml` — Builds and deploys iOS/Android apps
- `lockDeploys.yml` — Manages QA lock periods
- `test.yml`, `lint.yml`, `typecheck.yml` — CI checks
- `testBuild.yml` — Validates builds can complete

### Version Management

- Version bumping: `npm run bump` (automated script)
- Version format: `major.minor.patch-build` (e.g., `0.3.10-4`)

## Important Development Notes

### Firebase Rules

- Rules cascade: parent `.write: true` overrides child `.write: false`
- `.validate` rules don't cascade — must be set per-node
- For granular access control, use restrictive rules at parent nodes, then selectively allow at child nodes
- See README.md "Writing Firebase rules" section for detailed strategy

### Database Migrations

- Manual process via `_dev/database/migration-scripts/`
- Place input database in `_dev/migrations/input/`
- Run migration scripts via `_dev/main.tsx` using Bun or ts-node
- Output appears in `_dev/migrations/output/`

### Maintenance Mode

- Schedule: `bun run maintenance:schedule`
- Cancel: `bun run maintenance:cancel`
- Controlled via `config/maintenance` node in Firebase
- Users see `UnderMaintenanceModal` when `maintenance_mode: true`

### Common Development Issues

- Android builds may fail with permissions: `chmod +x ./android/gradlew`
- Invalid dependencies: `npx expo install --fix`
- iOS pod issues: Use `npm run ios:pod:reset`
- Ensure `ANDROID_HOME` env var is set to Android SDK location

## Contribution Guidelines

- All commits must be signed (GPG)
- Follow Conventional Commits format: `feat:`, `fix:`, `refactor:`, `ci:`, etc.
- PRs target `dev` branch (never `staging` or `master`)
- Avoid GitHub keywords in PR comments that can trigger workflows
- Include manual test plans for UI changes
- Ensure tests, lint, and typecheck pass before PR submission

## Code Style

- TypeScript strict mode enforced
- Prettier for formatting (2 spaces, single quotes, trailing commas)
- ESLint with Airbnb + Expensify + custom Kiroku config
- Naming: `camelCase` for variables/functions, `PascalCase` for components/types, `UPPER_CASE` for constants
- Prefer `type` over `interface`; avoid `enum`
- Shell scripts formatted with `shell-format`
