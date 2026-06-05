import React, {useCallback} from 'react';
import OnboardingScreenLayout from '@components/OnboardingScreenLayout';
import TermsScreenContent from '@components/TermsScreenContent';
import useLocalize from '@hooks/useLocalize';
import type {OnboardingModalNavigatorParamList} from '@libs/Navigation/types';
import * as Onboarding from '@userActions/Onboarding';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type {StackScreenProps} from '@react-navigation/stack';

type TermsScreenProps = StackScreenProps<
  OnboardingModalNavigatorParamList,
  typeof SCREENS.ONBOARDING.TERMS
>;

function TermsScreen({navigation}: TermsScreenProps) {
  const {translate} = useLocalize();

  // Navigate within the OnboardingModalNavigator's inner stack instead of
  // through the global `Navigation` helper. The global helper routes through
  // `linkTo`, which dispatches PUSH on the root stack and would append a
  // duplicate `ONBOARDING_MODAL_NAVIGATOR` entry — `dismissModal()` only pops
  // one, exposing the duplicate Terms screen below.
  const handleAccept = useCallback(() => {
    Onboarding.acceptTerms(ROUTES.ONBOARDING_TERMS);
    navigation.navigate(SCREENS.ONBOARDING.DISPLAY_NAME);
  }, [navigation]);

  return (
    <OnboardingScreenLayout
      testID={TermsScreen.displayName}
      currentStep={1}
      totalSteps={2}
      isFirstScreen>
      <TermsScreenContent
        title={translate('onboarding.terms.heading')}
        description={translate('onboarding.terms.description')}
        onAccept={handleAccept}
        fillContainer
      />
    </OnboardingScreenLayout>
  );
}

TermsScreen.displayName = 'TermsScreen';

export default TermsScreen;
