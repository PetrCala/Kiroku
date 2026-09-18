import React, {useState} from 'react';
import CONST from '@src/CONST';
import type {StackScreenProps} from '@react-navigation/stack';
import type {DrinkingSessionNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import DrinkingSessionWindow from '@components/DrinkingSessionWindow';
import LocationTaggingPrompt from '@components/LocationTaggingPrompt';
import ScreenWrapper from '@components/ScreenWrapper';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import * as App from '@userActions/App';
import type DeepValueOf from '@src/types/utils/DeepValueOf';
import Navigation from '@libs/Navigation/Navigation';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';

type LiveSessionScreenProps = StackScreenProps<
  DrinkingSessionNavigatorParamList,
  typeof SCREENS.DRINKING_SESSION.LIVE
>;

function LiveSessionScreen({route}: LiveSessionScreenProps) {
  const {sessionId, backTo} = route.params;
  // The live editing buffer. Mutations persist themselves through the standard
  // action pipeline (see DrinkingSession.scheduleLiveSessionPersist), so the
  // screen no longer runs its own debounced sync.
  const [session] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);

  // Ending or discarding a session clears ONGOING_SESSION_DATA *before* the
  // navigation lands. Hold the last loaded session so this screen keeps
  // rendering its content while it slides out, instead of flipping to the
  // initial-load indicator mid-transition. The genuine initial gap (buffer not
  // yet populated) still shows the loader. Mirrors EditSessionScreen.
  const [displaySession, setDisplaySession] = useState(session);
  if (session && session !== displaySession) {
    setDisplaySession(session);
  }

  const onNavigateBack = (
    action: DeepValueOf<typeof CONST.NAVIGATION.SESSION_ACTION>,
  ) => {
    if (action === CONST.NAVIGATION.SESSION_ACTION.SAVE) {
      // REPLACE the live screen with the summary rather than pushing on top of
      // it. The session is saved and its buffer is cleared, so this screen has
      // nothing left to show: leaving it on the stack made every system back
      // affordance (Android back, the iOS swipe, browser back) land on a dead
      // loading screen. Replacing means the summary is the only session screen
      // in the stack, and any way back out of it closes the modal onto
      // whatever the flow was opened over.
      Navigation.navigate(
        ROUTES.DRINKING_SESSION_SUMMARY.getRoute(sessionId),
        CONST.NAVIGATION.TYPE.UP,
      );
      return;
    }
    // BACK and DISCARD leave the flow. `backTo` only steers those: a saved
    // session always ends on its summary, whatever route opened the screen.
    if (backTo) {
      Navigation.navigate(backTo as Route);
      return;
    }
    // Use dismissModal instead of navigate(HOME) to avoid double animation
    // The home screen is already underneath the modal
    Navigation.dismissModal();
  };

  if (!displaySession) {
    return <FullScreenLoadingIndicator />;
  }

  return (
    <ScreenWrapper
      testID={LiveSessionScreen.displayName}
      shouldShowOfflineIndicator={false}
      // Clear the "loading" overlay that Home shows while the session is created
      // only once the modal has finished sliding over Home. Clearing it earlier
      // (e.g. on focus) uncovers Home mid-transition and flashes its content.
      onEntryTransitionEnd={() => {
        App.setLoadingText(null);
      }}>
      <DrinkingSessionWindow
        onNavigateBack={onNavigateBack}
        sessionId={sessionId}
        session={displaySession}
        onyxKey={ONYXKEYS.ONGOING_SESSION_DATA}
        type={CONST.SESSION.TYPES.LIVE}
      />
      <LocationTaggingPrompt />
    </ScreenWrapper>
  );
}

LiveSessionScreen.displayName = 'Live Session Screen';
export default LiveSessionScreen;
