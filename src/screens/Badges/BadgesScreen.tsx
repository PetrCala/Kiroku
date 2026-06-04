import React from 'react';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import useLocalize from '@hooks/useLocalize';
import useReadyAfterScreenTransition from '@hooks/useReadyAfterScreenTransition';
import Navigation from '@libs/Navigation/Navigation';
import BadgesContent from './BadgesContent';
import BadgesScreenSkeleton from './BadgesScreenSkeleton';

/**
 * Defers the heavy body (`BadgesContent`, which runs the dominant
 * `buildDrinkEvents` pass via `useDrinkEvents`) until the entry transition
 * ends, so the navigation slide paints against a layout-faithful skeleton
 * instead of freezing the source screen mid-transition.
 * `InteractionManager.runAfterInteractions` is unsuitable here — it resolves
 * before the slide finishes (see `useReadyAfterScreenTransition`).
 */
function BadgesScreen() {
  const {translate} = useLocalize();
  const {isReady: didScreenTransitionEnd, onEntryTransitionEnd} =
    useReadyAfterScreenTransition();

  return (
    <ScreenWrapper
      testID={BadgesScreen.displayName}
      onEntryTransitionEnd={onEntryTransitionEnd}>
      <HeaderWithBackButton
        title={translate('badgesScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      {didScreenTransitionEnd ? <BadgesContent /> : <BadgesScreenSkeleton />}
    </ScreenWrapper>
  );
}

BadgesScreen.displayName = 'Badges Screen';
export default BadgesScreen;
