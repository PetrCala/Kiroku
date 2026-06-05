import type {EmptyObject} from '@src/types/utils/EmptyObject';

/** Presence heartbeat: the server recomputes `user_status/$uid` from the
 *  caller's own sessions, so no client-supplied data is sent. */
type SyncUserStatusParams = EmptyObject;

export default SyncUserStatusParams;
