import Onyx from 'react-native-onyx';
import type {Auth} from 'firebase/auth';
import {deleteUser, signOut} from 'firebase/auth';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import * as Localize from '@libs/Localize';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import {reauthentificateUser, reauthenticateWithOAuth} from './User';

/**
 * Clear CloseAccount error message to hide modal
 */
function clearError() {
  Onyx.merge(ONYXKEYS.FORMS.CLOSE_ACCOUNT_FORM, {errors: null});
}

/**
 * Set default Onyx data
 */
function setDefaultData() {
  Onyx.set(ONYXKEYS.FORMS.CLOSE_ACCOUNT_FORM, {
    ...CONST.DEFAULT_CLOSE_ACCOUNT_DATA,
  });
}

function setSuccessMessage(message: string) {
  Onyx.merge(ONYXKEYS.FORMS.CLOSE_ACCOUNT_FORM, {
    success: message,
  });
}

async function closeAccount(
  auth: Auth | null,
  reasonForLeaving: string,
  password: string,
  providerId: string,
) {
  const user = auth?.currentUser;

  if (!auth || !user) {
    throw new Error('Missing data. Try reloading the page');
  }

  if (providerId === CONST.AUTH_PROVIDER.PASSWORD) {
    const authentificationResult = await reauthentificateUser(user, password);
    if (!authentificationResult) {
      throw new Error(
        Localize.translateLocal('common.error.reauthenticationFailed'),
      );
    }
  } else {
    const oauthResult = await reauthenticateWithOAuth(user, providerId);
    if (oauthResult === null) {
      return;
    }
  }

  // kiroku-api owns the RTDB graph cleanup — the user's own subtrees, their
  // removal from every friend's/requester's map, and the exit-survey reason —
  // keyed off the caller's Firebase ID token. Awaited via
  // makeRequestWithSideEffects so the Firebase Auth deletion below only runs
  // after the server cleanup succeeds AND while the token is still valid (a
  // deleted Auth user can no longer mint one). The server emits the
  // state-clearing onyxData; an empty reason is omitted so none is recorded.
  // eslint-disable-next-line rulesdir/no-api-side-effects-method
  await API.makeRequestWithSideEffects(
    WRITE_COMMANDS.CLOSE_ACCOUNT,
    reasonForLeaving ? {reasonForLeaving} : {},
  );

  await deleteUser(user);

  // Updating the loading state here might cause some issues
  await signOut(auth);

  setSuccessMessage(Localize.translateLocal('closeAccount.successMessage'));
}

export {
  // eslint-disable-next-line import/prefer-default-export
  clearError,
  setDefaultData,
  setSuccessMessage,
  closeAccount,
};
