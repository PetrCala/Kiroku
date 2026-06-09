import React from 'react';
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
      // Use dismissModal instead of navigate(HOME) to avoid double animation
      // The home screen is already underneath the modal
      Navigation.dismissModal();
    }
  };

  if (!session) {
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
        session={session}
        onyxKey={ONYXKEYS.ONGOING_SESSION_DATA}
        type={CONST.SESSION.TYPES.LIVE}
      />
      <LocationTaggingPrompt />
    </ScreenWrapper>
  );
}

LiveSessionScreen.displayName = 'Live Session Screen';
export default LiveSessionScreen;
