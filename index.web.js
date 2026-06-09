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
// eslint-disable-next-line import/extensions
import {LoadSkiaWeb} from '@shopify/react-native-skia/lib/module/web/LoadSkiaWeb';

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
