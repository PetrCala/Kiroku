/**
 * CanvasKit readiness gate — native stub.
 *
 * On native, CanvasKit is linked into the binary and is always ready. The web
 * counterpart (skiaWeb.web.ts) lazily downloads the CanvasKit WASM on the
 * first call and waits for it before Skia modules are imported.
 */
function waitForCanvasKit(): Promise<void> {
  return Promise.resolve();
}

export default waitForCanvasKit;
