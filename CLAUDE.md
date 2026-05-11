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

TBA

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

TBA

### Action Modules (`src/libs/actions/`)

Major action categories:

- `App.ts`: Application lifecycle
- `User.ts`: User account operations
- `Session.ts`: Authentication

And others

## Build & Deployment

### CI/CD Workflows

Key GitHub Actions workflows:

- `deploy.yml`: Production deployment
- `preDeploy.yml`: Staging deployment
- `testBuild.yml`: PR test builds
- `test.yml`: Unit tests
- `typecheck.yml`: TypeScript validation
- `lint.yml`: Code quality checks

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

### Post-Edit Checklist (IMPORTANT)

**ALWAYS run these steps after making code changes, before committing:**

1. **Prettier**: Run `npx prettier --write <changed files>` on every file you modified. This is mandatory - CI will reject unformatted code.
2. **ESLint**: Run `npm run lint-changed` to catch lint errors early.
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

## Command Reference

### Common Tasks

```bash
# Install dependencies
npm install

# Clean build artifacts
npm run clean

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
