/**
 * Native clears `lastVisitedPath` on launch (see `initializeLastVisitedPath`),
 * so a cold start always lands on Home. With a live session running, it should
 * open the live session instead.
 */
const canAutoOpenLiveSessionOnColdStart = true;

export default canAutoOpenLiveSessionOnColdStart;
