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

    // DISCARD: the session is gone. When the edit was opened through the
    // session's summary, that summary now describes a deleted session, so pop
    // the whole DrinkingSession modal (summary + edit) to reveal the origin
    // beneath it: a single goBack would only return to the stale summary.
    if (
      action === CONST.NAVIGATION.SESSION_ACTION.DISCARD &&
      Navigation.getPreviousScreenName() === SCREENS.DRINKING_SESSION.SUMMARY
    ) {
      Navigation.popModalFlow();
      return;
    }

    // BACK and SAVE: go back one step, which is the origin this screen was
    // opened from. Opened through a summary, that is the summary itself: the
    // edit screen is a drill-down of the detail page, and the page re-reads the
    // session from the cache the save has just updated, so it comes back
    // showing the edit rather than stale values. Otherwise (e.g. a session
    // created from the day-overview picker) the edit screen is the modal's
    // root, so a single goBack bubbles out to the day overview.
    Navigation.goBack();
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
      shouldShowOfflineIndicator={false}
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
