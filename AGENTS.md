# Repository Guidelines

## Monorepo Layout (workspaces)
- Root is a workspace manager for:
  - `apps/mobile` (current app remains at repo root for now; migration optional later)
  - `apps/api` (Firebase Functions + Express)
  - `packages/kiroku-common` (pure TS: DBPATHS, shared types, update builders)
  - `packages/kiroku-api-client` (typed HTTP client for calling the API)

### Package Boundaries
- `packages/kiroku-common` must be pure: no imports from `react-native`, `firebase/*`, or `firebase-admin`.
- `apps/api` can import `firebase-admin` and `@kiroku/common`; it must not import `react-native`.
- Mobile app should eventually import shared logic from `@kiroku/common` and use `@kiroku/api-client` for mutations (reads/listeners may stay on client Firebase initially).

### Dev Commands
- Install workspaces: `bun i` (preferred) or `npm ci` at the repo root.
- Build packages: `npm run ws:build`.
- Start API emulators: `npm run ws:api` (requires firebase-tools).

### Environment for Functions URL
- App resolves Cloud Functions base automatically:
  - If `USE_EMULATORS=true`: `http://<HOST>:<FUNCTIONS_PORT>/<PROJECT_ID>/<REGION>/api`.
  - Else: `https://<REGION>-<PROJECT_ID>.cloudfunctions.net/api`.
- Optional overrides via `.env.*` (react-native-config):
  - `FUNCTIONS_URL` — full base URL override (takes precedence).
  - `FUNCTIONS_REGION` — default `us-central1`.
  - `FUNCTIONS_PORT` — emulator port (default `5001`).

### Migration Plan (high-level)
1) Extract shared: move DBPATHS, update builders, and minimal ID types to `@kiroku/common`.
2) Define contracts (later) and expand common types as needed.
3) Implement API routes in `apps/api` for write operations.
4) Add `@kiroku/api-client` and refactor app mutations to use it.
5) Keep realtime reads in app; phase out direct writes.

## Project Structure & Module Organization
- `src/` — React Native app code (TypeScript). Uses path aliases like `@components/*`, `@hooks/*`, `@libs/*`, `@src/*` (see `tsconfig.json`).
- `__tests__/` — tests grouped by `unit/`, `integration/`, `e2e/`, plus shared `utils/`.
- `__mocks__/` — Jest mocks for RN modules and libraries.
- `assets/` — images and other static assets.
- `ios/`, `android/` — native projects; `fastlane/` for CI builds.
- `.github/` — workflows and scripts; `docs/` — Jekyll site.
- `scripts/` — dev/build helpers.
- Platform files may use suffixes like `.ios.tsx`, `.android.tsx`, or `.native.tsx` where necessary.

## Build, Test, and Development Commands
- Install: `bun i` (preferred) or `npm ci`.
- Start Metro: `npm run start`.
- Run app: `npm run ios` or `npm run android`.
- Lint/format: `npm run lint`, `npm run prettier`.
- Tests: `npm test` (Jest + jest-expo). Debug: `npm run test:debug`.
- Firebase emulators e2e/integration: `npm run emulators` then `npm run test:emulators`.
- Release builds: `npm run ios-build`, `npm run android-build`.

## Coding Style & Naming Conventions
- TypeScript strict mode; format with Prettier; lint with ESLint (Airbnb + Expensify + RN rules).
- Indentation 2 spaces; single quotes; trailing commas (see `.prettierrc.js`).
- Naming: `camelCase` for vars/functions, `PascalCase` for components/types, `UPPER_CASE` for constants.
- Prefer `type` aliases over `interface`; avoid `enum` (see ESLint rules).
- Use published wrappers and hooks instead of restricted imports (e.g., `@components/Pressable` instead of RN touchables; `@components/Text` instead of `react-native/Text`).
- Use path aliases (e.g., `import Button from '@components/Button'`).

## Testing Guidelines
- Frameworks: Jest + `@testing-library/react-native`; preset `jest-expo` (`jest.config.js`).
- Place tests under `__tests__/unit`, `__tests__/integration`, or `__tests__/e2e`.
- File names: `*.test.ts(x)` or `*.spec.ts(x)`.
- Add/adjust tests with any logic change; use mocks from `__mocks__/` and global setup in `jest/`.

## Commit & Pull Request Guidelines
- Use Conventional Commits (e.g., `feat:`, `fix:`, `refactor:`, `ci:`). Example: `feat: add charts components`.
- PRs should include: clear description, linked issue, screenshots/GIFs for UI, and a concise test plan.
- Ensure `npm run lint` and `npm test` pass. Keep PRs focused and small.

## Security & Configuration Tips
- Do not commit secrets. Use `.env.development`, `.env.staging`, `.env.production` with `react-native-config`.
- Example: `USE_EMULATORS=true` to run against local Firebase emulators.
- Android builds require local SDK in `android/local.properties`; run `cd ios && pod install` for iOS.
