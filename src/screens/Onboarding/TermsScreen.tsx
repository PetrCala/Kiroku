import React, {useCallback} from 'react';
import OnboardingScreenLayout from '@components/OnboardingScreenLayout';
import TermsScreenContent from '@components/TermsScreenContent';
import {useFirebase} from '@context/global/FirebaseContext';
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
  const {auth, db} = useFirebase();
  const {translate} = useLocalize();

  // Navigate within the OnboardingModalNavigator's inner stack instead of
  // through the global `Navigation` helper. The global helper routes through
  // `linkTo`, which dispatches PUSH on the root stack and would append a
  // duplicate `ONBOARDING_MODAL_NAVIGATOR` entry — `dismissModal()` only pops
  // one, exposing the duplicate Terms screen below.
  const handleAccept = useCallback(async () => {
    await Onboarding.acceptTerms(db, auth.currentUser, ROUTES.ONBOARDING_TERMS);
    navigation.navigate(SCREENS.ONBOARDING.DISPLAY_NAME);
  }, [auth, db, navigation]);

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
