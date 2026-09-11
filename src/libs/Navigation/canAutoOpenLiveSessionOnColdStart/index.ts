/**
 * Web keeps the URL across a refresh, so a page load already lands where the
 * user was. Opening the live session there would hijack a plain refresh of
 * Home, so web never auto-opens it.
 */
const canAutoOpenLiveSessionOnColdStart = false;

export default canAutoOpenLiveSessionOnColdStart;
