import type {Preferences, Profile} from '@src/types/onyx';
import type {Timezone} from '@src/types/onyx/UserData';

type ProvisionUserParams = {
  profile: Profile;
  timezone?: Timezone;
  preferences?: Preferences;
};

export default ProvisionUserParams;
