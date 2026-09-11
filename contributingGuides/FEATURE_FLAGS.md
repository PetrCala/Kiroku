# Feature flags

Feature flags gate work that ships dark or needs a kill switch. There are two layers:

1. **Compile-time default:** `CONST.FEATURES` in `src/CONST.ts`. This is what a build does when nothing else says otherwise.
2. **Remote override:** `config/feature_flags/<FLAG>` in the Realtime Database, a boolean. When it's present it wins over the default, so a flag can be switched without a release.

## Reading a flag

- Non-React code: `FeatureFlags.isEnabled('FLAG')` (`src/libs/FeatureFlags.ts`).
- Components and hooks: `useFeatureFlag('FLAG')` (`src/hooks/useFeatureFlag.ts`). It re-renders when an override changes, so a kill switch takes effect on screen right away. Calling `isEnabled` during a render only picks up the change on the next unrelated re-render.

Never read `CONST.FEATURES` directly.

## How an override reaches the app

The override is part of the global `config` node, which the app receives:

- with every `OpenApp`
- with every reconnect catch-up
- live over the public Pusher `config` channel whenever an admin changes it

So a running app sees a change within seconds, and an app that was offline sees it when it reconnects.

Only a real boolean counts. A missing value, `null`, or anything that isn't a boolean falls back to the compile-time default.

## Setting an override

With admin rights, through kiroku-api, which writes the value and broadcasts the new config:

- `PUT /v1/admin/feature-flags/<FLAG>` with `{"enabled": false}` turns a flag off for everyone (the kill switch).
- `DELETE /v1/admin/feature-flags/<FLAG>` removes the override, so every build goes back to its compile-time default.
- `GET /v1/admin/feature-flags` lists the current overrides.

Prefer overrides as kill switches. Forcing a flag on also works, but only builds that contain the feature's code can act on it. Do that only for flags whose code shipped in every build still in use.
