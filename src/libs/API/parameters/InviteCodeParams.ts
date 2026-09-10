/** Params for the invite preview and redeem routes (`/v1/friends/invite/:code`). */
type InviteCodeParams = {
  /** The invite code from a personal invite link. */
  code: string;
};

export default InviteCodeParams;
