import Onyx from 'react-native-onyx';
import {Alert} from 'react-native';
import {Auth, deleteUser, signOut, type UserCredential} from 'firebase/auth';
import {Database} from 'firebase/database';
import {deleteUserData, reauthentificateUser} from '@database/users';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import {UserProps} from '@src/types/onyx';
import * as ErrorUtils from '@libs/ErrorUtils';
import useLocalize from '@hooks/useLocalize';

/**
 * Clear CloseAccount error message to hide modal
 */
function clearError() {
  Onyx.merge(ONYXKEYS.FORMS.DELETE_ACCOUNT_FORM, {errors: null});
}

/**
 * Set default Onyx data
 */
function setDefaultData() {
  Onyx.merge(ONYXKEYS.FORMS.DELETE_ACCOUNT_FORM, {
    ...CONST.DEFAULT_DELETE_ACCOUNT_DATA,
  });
}

async function deleteAccount(
  db: Database | null,
  auth: Auth | null,
  userData: UserProps | undefined,
  reasonForLeaving: string,
  password: string,
) {
  try {
    const user = auth?.currentUser;

    if (!db || !userData || !user) {
      throw new Error('Missing data. Try reloading the page');
    }

    // Reauthentificate the user
    let authentificationResult: void | UserCredential;
    authentificationResult = await reauthentificateUser(user, password);

    if (!authentificationResult) {
      throw new Error('Reauthentification failed');
    }

    const userNickname = userData.profile.display_name;
    await deleteUserData(
      db,
      user.uid,
      userNickname,
      userData.friends,
      userData.friend_requests,
    );
    await deleteUser(user);

    // Updating the loading state here might cause some issues
    await signOut(auth);

    // Add an alert here informing about the user deletion
    Navigation.navigate(ROUTES.LOGIN);
  } catch (error: any) {
    ErrorUtils.raiseAlert(
      error,
      'Error deleting the account. Please try again later',
    );
  }
}

export {
  // eslint-disable-next-line import/prefer-default-export
  clearError,
  setDefaultData,
  deleteAccount,
};
