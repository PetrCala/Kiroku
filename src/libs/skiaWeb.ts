/**
 * CanvasKit readiness gate — native stub.
 *
 * On native, CanvasKit is linked into the binary and is always ready. The
 * web counterpart (skiaWeb.web.ts) reads the background-load promise stored
 * by index.web.js and waits for it before Skia modules are imported.
 */
function waitForCanvasKit(): Promise<void> {
  return Promise.resolve();
}

export default waitForCanvasKit;
