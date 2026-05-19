# Patches

This directory contains patches applied to `node_modules/` by [`patch-package`](https://github.com/ds300/patch-package) during `postinstall`. Each patch monkey-patches a third-party dependency to fix a bug or work around behavior we can't change upstream. **Always document a new patch here when adding one** — including why it exists, what upstream issue/PR (if any) tracks it, and when it can be removed.

Patches are named `<package>+<version>+<NNN>+<short-description>.patch` so `patch-package` knows which version they apply to.

## `expo-modules-core`

### `expo-modules-core+3.0.18+001+disableViewRecycling.patch`

- **Reason**: Disables React Native view recycling for Expo modules. Expo Modules' Fabric view manager re-uses (recycles) view instances when they leave/re-enter the tree; some of our components hold per-instance native state that doesn't survive recycle correctly, causing visual glitches and crashes on the re-mount.
- **Upstream PR/issue**: 🛑 (no tracking issue filed)
- **Removable when**: Expo Modules adds an opt-out flag for view recycling, or we migrate off the affected components.

## `react-native`

### `react-native+0.81.4.patch`

- **Reason**: Pre-existing core-RN patch carried since the RN 0.81 upgrade. Multi-purpose. _TODO: split into named single-purpose patches and document each section._
- **Upstream PR/issue**: 🛑
- **Removable when**: each contained workaround is fixed upstream or moved to a more targeted patch.

## `react-native-modal`

### `react-native-modal+13.0.1.patch`

- **Reason**: Pre-existing patch on the modal library. _TODO: document specific behavior change._
- **Upstream PR/issue**: 🛑
- **Removable when**: documented behavior is fixed upstream.

## `react-native-reanimated`

### `react-native-reanimated+4.2.1+001+catch-all-exceptions-on-stoi.patch`

- **Reason**: Reanimated's `LayoutAnimationsProxy_Legacy::transferConfigFromNativeID` parses a `nativeID` string via `std::stoi`. The original code caught only `std::invalid_argument` and `std::out_of_range`, but the implementation can throw other exception types (e.g. `std::bad_alloc`) which propagate up and crash the app. This patch broadens the `catch` clause to catch-all (`...`) so layout-animation registration never aborts the process due to a malformed nativeID.
- **Upstream PR/issue**: 🛑
- **Cherry-picked from**: [Expensify/App `patches/react-native-reanimated/`](https://github.com/Expensify/App/tree/main/patches/react-native-reanimated) — introduced in their [RN 0.76 upgrade PR](https://github.com/Expensify/App/pull/51475).
- **Removable when**: Reanimated upstream broadens or removes the `stoi` call in a future release.

## `react-native-worklets`

### `react-native-worklets+0.7.2+001+fix-app-crash-SerializableRemoteFunction.patch`

- **Reason**: Fixes a SIGSEGV crash in the `SerializableRemoteFunction` destructor caused by a data race on `globalMarkdownWorkletRuntime`. The fix replaces the stored `jsi::Value` function reference with an ID-based lookup via a `__remoteFunctionCache` map, avoiding the unsafe cross-thread `~jsi::Value()` call during runtime teardown.
- **Upstream PR/issue**: N/A — patch authored by the `react-native-worklets` maintainer in [Expensify/react-native-live-markdown#752 (comment)](https://github.com/Expensify/react-native-live-markdown/pull/752#issuecomment-3953415007).
- **Cherry-picked from**: [Expensify/App `patches/react-native-worklets/`](https://github.com/Expensify/App/tree/main/patches/react-native-worklets) — they introduced it in [#83792](https://github.com/Expensify/App/pull/83792) for [issue #82146](https://github.com/Expensify/App/issues/82146).
- **Removable when**: a `react-native-worklets` release lands containing the equivalent fix (any version > 0.7.2 that resolves the upstream `__remoteFunctionCache` race).

> **Note**: the separate cold-start watchdog deadlock (the reason we're pinned to 0.7.2 in the first place) is _not_ fixed by this patch. It's fixed by being on 0.7.x at all — the `Shareable.cpp` lock-order inversion was introduced in 0.8.x. See the version pins in `package.json`.
