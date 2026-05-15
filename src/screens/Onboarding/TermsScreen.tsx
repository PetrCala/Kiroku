import ScreenWrapper from '@components/ScreenWrapper';
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
    <ScreenWrapper testID={TermsScreen.displayName}>
      <Text>TODO: Onboarding Terms</Text>
    </ScreenWrapper>
  );
}

TermsScreen.displayName = 'TermsScreen';

export default TermsScreen;
