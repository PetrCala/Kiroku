import type {UserID} from './OnyxCommon';
import type {Profile} from './UserData';

/**
 * Who a personal invite link belongs to, as returned by the public
 * `GET /v1/friends/invite/:code` preview. Only the fields the owner shares with
 * anyone holding the link; never stored in Onyx.
 */
type InvitePreview = {
  /** The invite owner's user ID */
  userID: UserID;

  /** The owner's display name and avatar */
  profile: Pick<Profile, 'display_name' | 'photo_url'>;
};

export default InvitePreview;
