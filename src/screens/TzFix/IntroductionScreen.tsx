import Button from '@components/Button';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import {TzFixModalNavigatorParamList} from '@libs/Navigation/types';
import {StackScreenProps} from '@react-navigation/stack';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import {View} from 'react-native';
import Onyx from 'react-native-onyx';

type IntroductionScreenProps = StackScreenProps<
  TzFixModalNavigatorParamList,
  typeof SCREENS.TZ_FIX.INTRODUCTION
>;

function IntroductionScreen({}: IntroductionScreenProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  const onConfirm = () => {
    Navigation.navigate(ROUTES.TZ_FIX_DETECTION);
  };

  return (
    <ScreenWrapper testID={IntroductionScreen.displayName}>
      <HeaderWithBackButton
        shouldShowBackButton={false}
        progressBarPercentage={1}
      />
      <View style={[styles.m5, styles.flexGrow1, styles.justifyContentBetween]}>
        <View>
          <Text style={[styles.textHeadline, styles.textAlignCenter]}>
            {translate('tzFix.introduction.title')}
          </Text>
          <Text style={[styles.mt6, styles.textAlignCenter]}>
            {translate('tzFix.introduction.text1')}
          </Text>
          <Text
            style={[styles.textHeadlineH2, styles.textAlignCenter, styles.mt6]}>
            {translate('tzFix.introduction.troubleWithTimezones')}
          </Text>
          <Text style={[styles.mt6, styles.textAlignCenter]}>
            {translate('tzFix.introduction.text2')}
          </Text>
          <Text
            style={[styles.textHeadlineH2, styles.textAlignCenter, styles.mt6]}>
            {translate('tzFix.introduction.whatDoesThisMean')}
          </Text>
          <Text style={[styles.mt6, styles.textAlignCenter]}>
            {translate('tzFix.introduction.text3')}
          </Text>
        </View>
        <Button
          success
          style={[styles.mt4, styles.mb1]}
          onPress={onConfirm}
          pressOnEnter
          large
          text={translate('tzFix.introduction.confirmButtonText')}
        />
      </View>
    </ScreenWrapper>
  );
}

IntroductionScreen.displayName = 'IntroductionScreen';

export default IntroductionScreen;
