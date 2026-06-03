import React from 'react';
import CONST from '@src/CONST';
import type {StackScreenProps} from '@react-navigation/stack';
import type {
  DrinkingSessionNavigatorParamList,
  State,
} from '@libs/Navigation/types';
import SCREENS from '@src/SCREENS';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import DrinkingSessionWindow from '@components/DrinkingSessionWindow';
import ScreenWrapper from '@components/ScreenWrapper';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import useLocalize from '@hooks/useLocalize';
import type DeepValueOf from '@src/types/utils/DeepValueOf';
import Navigation from '@libs/Navigation/Navigation';
import navigationRef from '@libs/Navigation/navigationRef';
import ROUTES from '@src/ROUTES';
import type {Route} from '@src/ROUTES';

type EditSessionScreenProps = StackScreenProps<
  DrinkingSessionNavigatorParamList,
  typeof SCREENS.DRINKING_SESSION.EDIT
>;

// TEMP NAV DEBUG — remove after diagnosis. Renders the navigation tree as
// indented `name` lines, marks the focused route per level with `>`, and shows
// any `params.screen` so we can see how Day Overview / Summary / Edit nest.
function serializeNavTree(state: State, depth = 0): string {
  const focusedIndex = state.index ?? state.routes.length - 1;
  return state.routes
    .map((route, i) => {
      const marker = i === focusedIndex ? '>' : ' ';
      const params = route.params as {screen?: string} | undefined;
      const screen = params?.screen ? ` screen=${params.screen}` : '';
      const child = route.state
        ? `\n${serializeNavTree(route.state, depth + 1)}`
        : '';
      return `${'  '.repeat(depth)}${marker}${route.name}${screen}${child}`;
    })
    .join('\n');
}

function EditSessionScreen({route}: EditSessionScreenProps) {
  const {sessionId, backTo} = route.params;
  const {translate} = useLocalize();
  const [session] = useOnyx(ONYXKEYS.EDIT_SESSION_DATA);

  const onNavigateBack = (
    action: DeepValueOf<typeof CONST.NAVIGATION.SESSION_ACTION>,
  ) => {
    // TEMP NAV DEBUG — remove after diagnosis.
    /* eslint-disable no-console */
    console.log('[NAVDEBUG] ----------------------------------------');
    console.log(
      '[NAVDEBUG] action =',
      action,
      '| backTo =',
      backTo ?? '(none)',
    );
    console.log(
      '[NAVDEBUG] getLastScreenName(true) =',
      Navigation.getLastScreenName(true),
    );
    console.log(
      '[NAVDEBUG] getPreviousScreenName() =',
      Navigation.getPreviousScreenName(),
    );
    console.log(
      `[NAVDEBUG] tree:\n${serializeNavTree(navigationRef.getRootState())}`,
    );
    /* eslint-enable no-console */

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
    // a just-edited or just-deleted session), so pop it together with the edit
    // screen. Otherwise (e.g. a session created from the day-overview FAB) a
    // single pop returns to the origin.
    if (
      Navigation.getPreviousScreenName() === SCREENS.DRINKING_SESSION.SUMMARY
    ) {
      Navigation.pop(2);
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
