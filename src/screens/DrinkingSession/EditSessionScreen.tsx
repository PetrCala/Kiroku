import React, {useState} from 'react';
import CONST from '@src/CONST';
import type {StackScreenProps} from '@react-navigation/stack';
import type {DrinkingSessionNavigatorParamList} from '@libs/Navigation/types';
import SCREENS from '@src/SCREENS';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import DrinkingSessionWindow from '@components/DrinkingSessionWindow';
import ScreenWrapper from '@components/ScreenWrapper';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import * as App from '@userActions/App';
import useLocalize from '@hooks/useLocalize';
import type DeepValueOf from '@src/types/utils/DeepValueOf';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import type {Route} from '@src/ROUTES';

type EditSessionScreenProps = StackScreenProps<
  DrinkingSessionNavigatorParamList,
  typeof SCREENS.DRINKING_SESSION.EDIT
>;

function EditSessionScreen({route}: EditSessionScreenProps) {
  const {sessionId, backTo} = route.params;
  const {translate} = useLocalize();
  const [session] = useOnyx(ONYXKEYS.EDIT_SESSION_DATA);

  // Saving or deleting clears EDIT_SESSION_DATA *before* the modal finishes
  // popping. Hold the last loaded session so the outgoing screen keeps rendering
  // its content during that teardown instead of flipping to the initial-load
  // "Loading your session" indicator — which both shows the wrong text and, by
  // swapping the whole screen tree mid-navigation, stops the pop from landing on
  // the Day Overview. The genuine initial gap (buffer not yet populated) still
  // shows the loader.
  const [displaySession, setDisplaySession] = useState(session);
  if (session && session !== displaySession) {
    setDisplaySession(session);
  }

  const onNavigateBack = (
    action: DeepValueOf<typeof CONST.NAVIGATION.SESSION_ACTION>,
  ) => {
    if (backTo) {
      if (backTo === ROUTES.HOME) {
        // The create flow stacks the date-pick and edit screens in the same
        // modal, so dismiss the whole modal in one slide instead of navigating
        // to a bottom-tab route (which forward-pushes and bounces).
        Navigation.dismissModal();
      } else {
        Navigation.goBack(backTo as Route);
      }
      return;
    }

    // BACK — return to wherever we came from (the summary when the edit was
    // opened through it, the day overview otherwise).
    if (action === CONST.NAVIGATION.SESSION_ACTION.BACK) {
      Navigation.goBack();
      return;
    }

    // SAVE or DISCARD — land on the originating day overview. When the edit was
    // opened through the session's summary, that summary is now stale (it shows
    // a just-edited or just-deleted session), so pop the whole DrinkingSession
    // modal (summary + edit) to reveal the day overview beneath it — a single
    // goBack would only return to the stale summary. Otherwise (e.g. a session
    // created from the day-overview FAB) the edit screen is the modal's root, so
    // a single goBack already bubbles back to the origin.
    if (
      Navigation.getPreviousScreenName() === SCREENS.DRINKING_SESSION.SUMMARY
    ) {
      Navigation.popModalFlow();
    } else {
      Navigation.goBack();
    }
  };

  if (!displaySession) {
    return (
      <FullScreenLoadingIndicator
        loadingText={translate('liveSessionScreen.loading')}
      />
    );
  }

  return (
    <ScreenWrapper
      testID={EditSessionScreen.displayName}
      // Match LiveSessionScreen: clear the open-time loading overlay only after the
      // modal transition completes, so Home never flashes mid-slide.
      onEntryTransitionEnd={() => {
        App.setLoadingText(null);
      }}>
      <DrinkingSessionWindow
        onNavigateBack={onNavigateBack}
        sessionId={sessionId}
        session={displaySession}
        onyxKey={ONYXKEYS.EDIT_SESSION_DATA}
        type={CONST.SESSION.TYPES.EDIT}
      />
    </ScreenWrapper>
  );
}

EditSessionScreen.displayName = 'Edit Session Screen';
export default EditSessionScreen;
