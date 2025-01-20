import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useFirebase} from '@context/global/FirebaseContext';
import * as DS from '@userActions/DrinkingSession';
import * as ErrorUtils from '@libs/ErrorUtils';
import type {DrinkingSession} from '@src/types/onyx';
import {useUserConnection} from '@context/global/UserConnectionContext';
import CONST from '@src/CONST';
import type {StackScreenProps} from '@react-navigation/stack';
import type {DrinkingSessionNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import DrinkingSessionWindow from '@components/DrinkingSessionWindow';
import useBatchedUpdates from '@hooks/useBatchedUpdates';
import ScreenWrapper from '@components/ScreenWrapper';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import UserOfflineModal from '@components/UserOfflineModal';
import {computeFirebaseUpdates} from '@database/updates';
import type DeepValueOf from '@src/types/utils/DeepValueOf';
import Navigation from '@libs/Navigation/Navigation';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import ERRORS from '@src/ERRORS';

type LiveSessionScreenProps = StackScreenProps<
  DrinkingSessionNavigatorParamList,
  typeof SCREENS.DRINKING_SESSION.LIVE
>;

function LiveSessionScreen({route}: LiveSessionScreenProps) {
  const {sessionId, backTo} = route.params;
  const {auth, db} = useFirebase();
  const user = auth.currentUser;
  const {isOnline} = useUserConnection();
  const [session] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);
  const sessionRef = useRef<DrinkingSession | undefined>(undefined);
  const [dbSyncSuccessful, setDbSyncSuccessful] = useState(false);

  const onNavigateBack = (
    action: DeepValueOf<typeof CONST.NAVIGATION.SESSION_ACTION>,
  ) => {
    if (backTo) {
      Navigation.navigate(backTo as Route);
      return;
    }
    if (action === CONST.NAVIGATION.SESSION_ACTION.SAVE) {
      Navigation.navigate(ROUTES.DRINKING_SESSION_SUMMARY.getRoute(sessionId));
    } else {
      Navigation.navigate(ROUTES.HOME);
    }
  };

  const syncWithDb = async (updates: Partial<DrinkingSession>) => {
    if (!user) {
      return;
    }
    try {
      await DS.updateDrinkingSessionData(
        db,
        user.uid,
        updates,
        sessionId,
        true, // Update live session status
      );
      setDbSyncSuccessful(true);
    } catch (error) {
      ErrorUtils.raiseAppError(ERRORS.SESSION.SAVE_FAILED, error);
    }
  };

  const processUpdates = async (updates: Partial<DrinkingSession>) => {
    await syncWithDb(updates);
  };

  const {isPending, enqueueUpdate: batchedEnqueue} = useBatchedUpdates(
    processUpdates,
    500,
  );

  const enqueueUpdate = useCallback(
    (updates: Partial<DrinkingSession>) => {
      batchedEnqueue(updates);
    },
    [batchedEnqueue],
  );

  // Synchronize the session with database
  useEffect(() => {
    // Only schedule a database update if any hooks changed
    const shouldRunUpdates =
      !!user && !!session?.ongoing && !!session && !!sessionRef.current;

    if (shouldRunUpdates) {
      const updates = computeFirebaseUpdates(sessionRef.current, session);
      if (updates) {
        setDbSyncSuccessful(false);
        enqueueUpdate(updates);
      }
    }
    sessionRef.current = session;
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
  }, [session, user]); // Do not include enqueueUpdate in the dependencies, as it will cause an infinite loop

  if (!isOnline) {
    return <UserOfflineModal />;
  }
  if (!session) {
    return <FullScreenLoadingIndicator />;
  }

  return (
    <ScreenWrapper testID={LiveSessionScreen.displayName}>
      <DrinkingSessionWindow
        onNavigateBack={onNavigateBack}
        sessionId={sessionId}
        session={session}
        shouldShowSyncPendingIndicator={isPending}
        shouldShowSyncSuccessIndicator={dbSyncSuccessful}
        onyxKey={ONYXKEYS.ONGOING_SESSION_DATA}
        type={CONST.SESSION.TYPES.LIVE}
      />
    </ScreenWrapper>
  );
}

LiveSessionScreen.displayName = 'Live Session Screen';
export default LiveSessionScreen;
