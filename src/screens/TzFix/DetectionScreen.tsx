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
import {SelectedTimezone} from '@src/types/onyx/PersonalDetails';
import {useEffect} from 'react';
import {View} from 'react-native';

type DetectionScreenProps = StackScreenProps<
  TzFixModalNavigatorParamList,
  typeof SCREENS.TZ_FIX.DETECTION
>;

function DetectionScreen({}: DetectionScreenProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  const currentTimezone = Intl.DateTimeFormat().resolvedOptions();

  const onCorrect = () => Navigation.navigate(ROUTES.TZ_FIX_CONFIRMATION);
  const onIncorrect = () => Navigation.navigate(ROUTES.TZ_FIX_SELECTION);

  return (
    <ScreenWrapper testID={DetectionScreen.displayName}>
      <HeaderWithBackButton
        onBackButtonPress={() => Navigation.goBack(ROUTES.TZ_FIX_INTRODUCTION)}
        progressBarPercentage={33}
      />
      <View style={[styles.m5, styles.flexGrow1, styles.justifyContentBetween]}>
        <View>
          <Text style={[styles.textHeadline, styles.textAlignCenter]}>
            {translate('tzFix.detection.title')}
          </Text>
          <Text style={[styles.mt6, styles.textAlignCenter]}>
            {translate('tzFix.detection.isTimezoneCorrect')}
          </Text>
          <Text
            style={[
              styles.mt8,
              styles.textHeadlineH1,
              styles.textXLarge,
              styles.textAlignCenter,
            ]}>
            {currentTimezone.timeZone}
          </Text>
        </View>
        <View>
          <Button
            success
            style={[styles.mt4]}
            onPress={onCorrect}
            pressOnEnter
            large
            text={translate('tzFix.detection.correct')}
          />
          <Button
            danger
            style={[styles.mt2, styles.mb1]}
            onPress={onIncorrect}
            large
            text={translate('tzFix.detection.incorrect')}
          />
        </View>
      </View>
    </ScreenWrapper>
  );
}

DetectionScreen.displayName = 'DetectionScreen';

export default DetectionScreen;
