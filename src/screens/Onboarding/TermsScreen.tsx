import React, {useCallback} from 'react';
import OnboardingScreenLayout from '@components/OnboardingScreenLayout';
import TermsScreenContent from '@components/TermsScreenContent';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import Navigation from '@libs/Navigation/Navigation';
import type {OnboardingModalNavigatorParamList} from '@libs/Navigation/types';
import * as Onboarding from '@userActions/Onboarding';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type {StackScreenProps} from '@react-navigation/stack';

type TermsScreenProps = StackScreenProps<
  OnboardingModalNavigatorParamList,
  typeof SCREENS.ONBOARDING.TERMS
>;

// eslint-disable-next-line no-empty-pattern
function TermsScreen({}: TermsScreenProps) {
  const {auth, db} = useFirebase();
  const {translate} = useLocalize();

  const handleAccept = useCallback(async () => {
    await Onboarding.acceptTerms(db, auth.currentUser, ROUTES.ONBOARDING_TERMS);
    Navigation.navigate(ROUTES.ONBOARDING_DISPLAY_NAME);
  }, [auth, db]);

  return (
    <OnboardingScreenLayout
      testID={TermsScreen.displayName}
      title={translate('onboarding.terms.title')}
      currentStep={1}
      totalSteps={2}
      hasMore
      isFirstScreen>
      <TermsScreenContent
        title={translate('onboarding.terms.heading')}
        onAccept={handleAccept}
      />
    </OnboardingScreenLayout>
  );
}

TermsScreen.displayName = 'TermsScreen';

export default TermsScreen;
