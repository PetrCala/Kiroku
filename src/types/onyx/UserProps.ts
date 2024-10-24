import type {UserID, UserList} from './OnyxCommon';
import type FriendRequestList from './FriendRequestList';
import type {Timezone} from '@src/types/onyx/PersonalDetails';

type Profile = {
  first_name?: string; // TODO: make required from 0.4.x
  last_name?: string; // TODO: make required from 0.4.x
  display_name: string;
  photo_url: string;
};

type UserPrivateData = {
  birthdate?: number;
  weight?: number;
  gender?: string;
  timezone?: Timezone;
};

type UserPublicData = {
  last_active?: number;
};

type UserProps = {
  email_verified?: boolean;
  profile: Profile;
  private_data?: UserPrivateData;
  public_data?: UserPublicData;
  friends?: UserList;
  friend_requests?: FriendRequestList;
  role: string;
};

type UserPropsList = Record<UserID, UserProps>;

type ProfileList = Record<UserID, Profile>;

export default UserProps;
export type {
  Profile,
  UserPublicData,
  UserPrivateData,
  UserPropsList,
  ProfileList,
};
