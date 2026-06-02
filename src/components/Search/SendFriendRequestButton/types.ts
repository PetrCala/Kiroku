import type {FriendRequestStatus} from '@src/types/onyx';

type SendFriendRequestButtonProps = {
  userFrom: string;
  userTo: string;
  requestStatus: FriendRequestStatus | undefined;
  alreadyAFriend: boolean;
};

export default SendFriendRequestButtonProps;
