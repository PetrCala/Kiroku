import {useCallback} from 'react';
import type {Database} from 'firebase/database';
import type {User} from 'firebase/auth';
import {useFirebase} from '@context/global/FirebaseContext';
import * as App from '@userActions/App';
import * as DS from '@userActions/DrinkingSession';
import * as ErrorUtils from '@libs/ErrorUtils';
import ERRORS from '@src/ERRORS';
import type {SelectedTimezone} from '@src/types/onyx/UserData';
import useCurrentUserData from './useCurrentUserData';
import useLocalize from './useLocalize';

// Module-level so React Compiler skips it — the `try/finally` it needs bails
// the compiler, and that would regress the compilation of any component that
// inlines it.
async function startEditSessionForDate(
  db: Database,
  user: User | null,
  date: Date,
  timezone: SelectedTimezone | undefined,
  loadingText: string,
) {
  try {
    await App.setLoadingText(loadingText);
    const newSession = await DS.getNewSessionToEdit(db, user, date, timezone);
    await DS.navigateToEditSessionScreen(newSession?.id);
  } catch (error) {
    ErrorUtils.raiseAppError(ERRORS.DATABASE.USER_CREATION_FAILED, error);
  } finally {
    await App.setLoadingText(null);
  }
}

/**
 * Returns a callback that creates a new editable (draft) drinking session for
 * the given date and navigates to the edit-session screen. Always operates on
 * the current user. Used by the day-overview add-session picker and the
 * calendar day long-press shortcut.
 */
function useStartEditSessionForDate(): (date: Date) => void {
  const {auth, db} = useFirebase();
  const userData = useCurrentUserData();
  const {translate} = useLocalize();
  const selectedTimezone = userData?.timezone?.selected;

  return useCallback(
    (date: Date) => {
      // startEditSessionForDate handles its own errors; the .catch is a no-op
      // to satisfy no-floating-promises.
      startEditSessionForDate(
        db,
        auth.currentUser,
        date,
        selectedTimezone,
        translate('liveSessionScreen.loading'),
      ).catch(() => {});
    },
    [db, auth, selectedTimezone, translate],
  );
}

export default useStartEditSessionForDate;
