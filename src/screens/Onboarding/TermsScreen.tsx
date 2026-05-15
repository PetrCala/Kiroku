import OnboardingScreenLayout from '@components/OnboardingScreenLayout';
import Text from '@components/Text';
import type {OnboardingModalNavigatorParamList} from '@libs/Navigation/types';
import type {StackScreenProps} from '@react-navigation/stack';
import type SCREENS from '@src/SCREENS';

type TermsScreenProps = StackScreenProps<
  OnboardingModalNavigatorParamList,
  typeof SCREENS.ONBOARDING.TERMS
>;

// eslint-disable-next-line no-empty-pattern
function TermsScreen({}: TermsScreenProps) {
  return (
    <OnboardingScreenLayout
      testID={TermsScreen.displayName}
      currentStep={1}
      totalSteps={2}
      hasMore
      isFirstScreen>
      <Text>TODO: Onboarding Terms</Text>
    </OnboardingScreenLayout>
  );
}

TermsScreen.displayName = 'TermsScreen';

export default TermsScreen;
