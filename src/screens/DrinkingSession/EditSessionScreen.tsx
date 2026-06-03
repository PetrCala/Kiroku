import React from 'react';
import {useUserConnection} from '@context/global/UserConnectionContext';
import CONST from '@src/CONST';
import type {StackScreenProps} from '@react-navigation/stack';
import type {DrinkingSessionNavigatorParamList} from '@libs/Navigation/types';
import SCREENS from '@src/SCREENS';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import DrinkingSessionWindow from '@components/DrinkingSessionWindow';
import ScreenWrapper from '@components/ScreenWrapper';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import UserOfflineModal from '@components/UserOfflineModal';
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
  const {isOnline} = useUserConnection();
  const {translate} = useLocalize();
  const [session] = useOnyx(ONYXKEYS.EDIT_SESSION_DATA);

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
    const previousScreenName = Navigation.getLastScreenName(true);
    if (action === CONST.NAVIGATION.SESSION_ACTION.SAVE) {
      if (previousScreenName === SCREENS.DAY_OVERVIEW.ROOT) {
        Navigation.goBack();
      } else if (previousScreenName === SCREENS.DRINKING_SESSION.SUMMARY) {
        Navigation.goBack();
      } else {
        // Use dismissModal instead of navigate(HOME) to avoid double animation
        Navigation.dismissModal();
      }
    } else if (action === CONST.NAVIGATION.SESSION_ACTION.DISCARD) {
      // The session no longer exists, so returning to its summary would land on
      // a stale screen. Dismiss the whole session modal so the user lands on
      // the screen beneath it — the day overview when opened from there,
      // otherwise home.
      Navigation.dismissModal();
    } else {
      // BACK — return to wherever we came from (e.g. the summary).
      Navigation.goBack();
    }
  };

  if (!isOnline) {
    return <UserOfflineModal />;
  }
  if (!session) {
    return (
      <FullScreenLoadingIndicator
        loadingText={translate('liveSessionScreen.loading')}
      />
    );
  }

  return (
    <ScreenWrapper testID={EditSessionScreen.displayName}>
      <DrinkingSessionWindow
        onNavigateBack={onNavigateBack}
        sessionId={sessionId}
        session={session}
        onyxKey={ONYXKEYS.EDIT_SESSION_DATA}
        type={CONST.SESSION.TYPES.EDIT}
      />
    </ScreenWrapper>
  );
}

EditSessionScreen.displayName = 'Edit Session Screen';
export default EditSessionScreen;
