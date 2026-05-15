import ScreenWrapper from '@components/ScreenWrapper';
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
    <ScreenWrapper testID={DisplayNameScreen.displayName}>
      <Text>TODO: Onboarding Display Name</Text>
    </ScreenWrapper>
  );
}

DisplayNameScreen.displayName = 'DisplayNameScreen';

export default DisplayNameScreen;
