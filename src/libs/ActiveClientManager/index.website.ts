/**
 * Phase 0 web stub. Real multi-tab leader election (tracking clientIDs in Onyx so only one tab
 * processes the persisted write queue) is deferred to a later web increment — it needs an
 * `ACTIVE_CLIENTS` Onyx key + an `ActiveClients` action that Kiroku doesn't have yet (see #930/#934).
 * Until then web behaves like native: a single client that is always the leader.
 */
import type {Init, IsClientTheLeader, IsReady} from './types';

const init: Init = () => {};

const isClientTheLeader: IsClientTheLeader = () => true;

const isReady: IsReady = () => Promise.resolve();

export {init, isClientTheLeader, isReady};
