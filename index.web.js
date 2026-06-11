/**
 * @format
 *
 * Web entry point.
 *
 * `@shopify/react-native-skia` (used by the Statistics charts through
 * `victory-native`) binds CanvasKit at *import* time on web — `Skia.web.ts`
 * runs `JsiSkApi(global.CanvasKit)` the moment the module is evaluated, so the
 * resulting `Skia` object captures whatever `global.CanvasKit` is at that
 * instant. The chart code lives in a lazily-loaded chunk, so we must finish
 * initializing the CanvasKit WASM *before* that chunk (and its Skia import) is
 * evaluated, or every chart throws (`CanvasKit.XYWHRect` on `undefined`).
 *
 * Load CanvasKit up front, then boot the app. The ~8MB WASM is fetched once and
 * browser-cached. Importing the dedicated `LoadSkiaWeb` module (not the `web`
 * barrel) keeps `Skia.web.ts` out of the main bundle so it isn't evaluated
 * early. Native links CanvasKit into the binary and uses `index.js` directly.
 */
import {Dimensions} from 'react-native';
// eslint-disable-next-line import/extensions
import {LoadSkiaWeb} from '@shopify/react-native-skia/lib/module/web/LoadSkiaWeb';

/*
 * Desktop "phone frame" (issue #1219).
 *
 * Kiroku is mobile-first (native bottom tabs, no central pane), so on a wide
 * desktop window the layout inherited from Expensify pins the tab content to a
 * 375px column and leaves ~70% of the window an empty central pane. Instead we
 * render the app at a phone width, centered on a backdrop (CSS in
 * web/index.html), and make the app *believe* the viewport is that width so it
 * uses its existing, already-clean mobile layout and every overlay (modals,
 * RHP, FAB, popovers) positions against the frame rather than the real window.
 *
 * react-native-web's `useWindowDimensions` resolves entirely through
 * `Dimensions.get('window')` + its `'change'` event, so clamping `Dimensions`
 * here is the single source of truth for both the ~28 `useWindowDimensions`
 * consumers AND the few helpers that read `Dimensions.get('window')` directly
 * (e.g. `getIsSmallScreenWidth` -> the navigation router, `commonStyles`). Only
 * the width of `'window'` is clamped, and only above the breakpoint, so real
 * mobile / narrow desktop windows are untouched. Keep FRAME_WIDTH / BREAKPOINT
 * in sync with web/index.html and variables.mobileResponsiveWidthBreakpoint.
 */
const FRAME_WIDTH = 480;
const BREAKPOINT = 800;
const clampWindow = window => {
  if (
    !window ||
    typeof window.width !== 'number' ||
    window.width <= BREAKPOINT
  ) {
    return window;
  }
  return {...window, width: FRAME_WIDTH};
};
const originalGet = Dimensions.get.bind(Dimensions);
Dimensions.get = dimension =>
  dimension === 'window'
    ? clampWindow(originalGet('window'))
    : originalGet(dimension);
// Wrap 'change' so live resizes stay clamped. Preserve handler identity via a
// WeakMap so react-native-web's `removeEventListener('change', handler)` (which
// matches by reference) still finds and removes the wrapped listener.
const wrappedChangeHandlers = new WeakMap();
const originalAddEventListener = Dimensions.addEventListener.bind(Dimensions);
Dimensions.addEventListener = (type, handler) => {
  if (type !== 'change' || typeof handler !== 'function') {
    return originalAddEventListener(type, handler);
  }
  const wrapped = ({window, screen}) =>
    handler({window: clampWindow(window), screen});
  wrappedChangeHandlers.set(handler, wrapped);
  return originalAddEventListener('change', wrapped);
};
if (typeof Dimensions.removeEventListener === 'function') {
  const originalRemoveEventListener =
    Dimensions.removeEventListener.bind(Dimensions);
  Dimensions.removeEventListener = (type, handler) => {
    if (type !== 'change' || typeof handler !== 'function') {
      return originalRemoveEventListener(type, handler);
    }
    return originalRemoveEventListener(
      'change',
      wrappedChangeHandlers.get(handler) ?? handler,
    );
  };
}

// The CanvasKit WASM is emitted at the web root by the webpack CopyPlugin.
LoadSkiaWeb({locateFile: () => '/canvaskit.wasm'})
  .catch(() => {
    // If CanvasKit can't load, still boot — only the charts depend on it.
  })
  .finally(() => {
    // Defer the app (and its transitive Skia imports) until CanvasKit is ready.
    // The explicit `.js` extension is required so this doesn't resolve back to
    // `index.web.js` (this file) and recurse.
    // eslint-disable-next-line import/extensions
    require('./index.js');
  });
