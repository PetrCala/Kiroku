import type {Errors, PendingAction, UserID} from './OnyxCommon';

/** Offline-feedback state for a single friend action, keyed by counterpart userID. */
type FriendActionMetadata = {
  /** The type of friend action that is pending (add/update/delete) */
  pendingAction?: PendingAction;

  /** Dismissible errors surfaced when the queued friend write fails */
  errors?: Errors | null;
};

/** Per-friend offline-feedback state, keyed by the counterpart's userID. */
type FriendsMetadata = Record<UserID, FriendActionMetadata>;

export default FriendsMetadata;
export type {FriendActionMetadata};
