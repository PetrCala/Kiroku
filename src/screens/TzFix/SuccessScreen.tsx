import Button from '@components/Button';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import type {TzFixModalNavigatorParamList} from '@libs/Navigation/types';
import type {StackScreenProps} from '@react-navigation/stack';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import {View} from 'react-native';

type SuccessScreenProps = StackScreenProps<
  TzFixModalNavigatorParamList,
  typeof SCREENS.TZ_FIX.SUCCESS
>;

// eslint-disable-next-line no-empty-pattern
function SuccessScreen({}: SuccessScreenProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  const onConfirm = () => {
    Navigation.navigate(ROUTES.HOME);
  };

  return (
    <ScreenWrapper testID={SuccessScreen.displayName}>
      <HeaderWithBackButton
        shouldShowBackButton={false}
        progressBarPercentage={100}
      />
      <View style={[styles.m5, styles.flexGrow1, styles.justifyContentBetween]}>
        <View>
          <Text style={[styles.textHeadline, styles.textAlignCenter]}>
            {translate('tzFix.success.title')}
          </Text>
          <Text style={[styles.mt6, styles.textAlignCenter]}>
            {translate('tzFix.success.text1')}
          </Text>
          <Text style={[styles.mt4, styles.textAlignCenter]}>
            {translate('tzFix.success.text2')}
          </Text>
        </View>
        <Button
          success
          style={[styles.mt4, styles.mb1]}
          onPress={onConfirm}
          pressOnEnter
          large
          text={translate('tzFix.success.finishButton')}
        />
      </View>
    </ScreenWrapper>
  );
}

SuccessScreen.displayName = 'SuccessScreen';

export default SuccessScreen;
