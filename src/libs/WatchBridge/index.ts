/**
 * Watch credential bridge, iOS-only (see ./index.ios.ts). On every other
 * platform (and under jest, where the native module is absent) there is no
 * watch to feed, so initialization is a no-op.
 */
function init(): void {}

export default {init};
