/**
 * CanvasKit readiness gate — web implementation.
 *
 * The CanvasKit WASM is ~8 MB raw (~2.4 MB brotli) and only the Statistics
 * charts need it, so it is loaded lazily: the first call here *starts* the
 * download and memoizes the promise, so concurrent and repeat callers share a
 * single load. Nothing touches it at boot, so a logged-out visitor or a user
 * who never opens the charts never pays for it.
 *
 * Chart code calls this before importing any @shopify/react-native-skia
 * module; Skia.web.ts runs JsiSkApi(global.CanvasKit) at import time, so the
 * module must not be evaluated until CanvasKit is initialized. LoadSkiaWeb is
 * pulled from its dedicated module (not the `web` barrel) so loading it does
 * not drag Skia.web.ts in with it, and the import is dynamic so neither ends
 * up in the main bundle.
 *
 * A failed load resolves instead of rejecting, so charts degrade gracefully
 * rather than throwing; the memo is cleared in that case so a later visit to
 * the charts can retry.
 */
let canvasKitPromise: Promise<void> | undefined;

function loadCanvasKit(): Promise<void> {
  return (
    import('@shopify/react-native-skia/lib/module/web/LoadSkiaWeb')
      // The WASM file is emitted at the web root by the webpack CopyPlugin.
      .then(({LoadSkiaWeb}) =>
        LoadSkiaWeb({locateFile: () => '/canvaskit.wasm'}),
      )
      .catch(() => {
        canvasKitPromise = undefined;
      })
  );
}

function waitForCanvasKit(): Promise<void> {
  canvasKitPromise ??= loadCanvasKit();
  return canvasKitPromise;
}

export default waitForCanvasKit;
