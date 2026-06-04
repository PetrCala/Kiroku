import React from 'react';
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
    } else {
      Navigation.goBack();
    }
  };

  if (!session) {
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
        session={session}
        onyxKey={ONYXKEYS.EDIT_SESSION_DATA}
        type={CONST.SESSION.TYPES.EDIT}
      />
    </ScreenWrapper>
  );
}

EditSessionScreen.displayName = 'Edit Session Screen';
export default EditSessionScreen;
