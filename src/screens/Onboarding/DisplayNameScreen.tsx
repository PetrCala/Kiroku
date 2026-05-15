import OnboardingScreenLayout from '@components/OnboardingScreenLayout';
import Text from '@components/Text';
import type {OnboardingModalNavigatorParamList} from '@libs/Navigation/types';
import type {StackScreenProps} from '@react-navigation/stack';
import type SCREENS from '@src/SCREENS';

type DisplayNameScreenProps = StackScreenProps<
  OnboardingModalNavigatorParamList,
  typeof SCREENS.ONBOARDING.DISPLAY_NAME
>;

// eslint-disable-next-line no-empty-pattern
function DisplayNameScreen({}: DisplayNameScreenProps) {
  return (
    <OnboardingScreenLayout
      testID={DisplayNameScreen.displayName}
      currentStep={2}
      totalSteps={2}
      hasMore>
      <Text>TODO: Onboarding Display Name</Text>
    </OnboardingScreenLayout>
  );
}

DisplayNameScreen.displayName = 'DisplayNameScreen';

export default DisplayNameScreen;
