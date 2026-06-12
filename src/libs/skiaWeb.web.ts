/**
 * CanvasKit readiness gate — web implementation.
 *
 * index.web.js starts LoadSkiaWeb() in the background (fire-and-forget) and
 * stores the resulting promise on window.canvasKitReady before booting the
 * app. Chart code calls this before importing any @shopify/react-native-skia
 * module; Skia.web.ts runs JsiSkApi(global.CanvasKit) at import time, so the
 * module must not be evaluated until CanvasKit is initialized.
 *
 * If CanvasKit has already loaded the stored promise is resolved and this
 * returns immediately. If it failed to load the promise resolves anyway (the
 * .catch in index.web.js swallows the error) and charts may fail gracefully —
 * same behaviour as the previous "boot after WASM" fallback path.
 */
function waitForCanvasKit(): Promise<void> {
  const p = (window as {canvasKitReady?: Promise<void>}).canvasKitReady;
  return p ?? Promise.resolve();
}

export default waitForCanvasKit;
