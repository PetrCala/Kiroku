import Button from '@components/Button';
import ConfirmModal from '@components/ConfirmModal';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import {TzFixModalNavigatorParamList} from '@libs/Navigation/types';
import {StackScreenProps} from '@react-navigation/stack';
import * as ErrorUtils from '@libs/ErrorUtils';
import DSUtils from '@libs/DrinkingSessionUtils';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import {useState} from 'react';
import {View} from 'react-native';
import {useFirebase} from '@context/global/FirebaseContext';
import {SelectedTimezone} from '@src/types/onyx/PersonalDetails';

type ConfirmationScreenProps = StackScreenProps<
  TzFixModalNavigatorParamList,
  typeof SCREENS.TZ_FIX.CONFIRMATION
>;

function ConfirmationScreen({}: ConfirmationScreenProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {db, auth} = useFirebase();
  const currentTimezone = Intl.DateTimeFormat().resolvedOptions();
  const {userData, drinkingSessionData} = useDatabaseData();
  const [isSynchronizing, setIsSynchronizing] = useState(false);

  const [shouldShowCancelConfirmModal, setShouldShowCancelConfirmModal] =
    useState(false);

  const toggleCancelConfirmModal = (value: boolean) => {
    setShouldShowCancelConfirmModal(value);
  };

  const selectedTimezone =
    userData?.private_data?.timezone?.selected ?? currentTimezone.timeZone;

  const onCorrect = async () => {
    try {
      setIsSynchronizing(true);
      await DSUtils.fixTimezoneSessions(
        db,
        auth.currentUser?.uid,
        drinkingSessionData,
        selectedTimezone as SelectedTimezone,
      );
      Navigation.navigate(ROUTES.TZ_FIX_SUCCESS);
    } catch (error) {
      ErrorUtils.raiseAlert(
        error,
        translate('tzFix.confirmation.error.generic'),
      );
    } finally {
      setIsSynchronizing(false);
    }
  };

  const onIncorrect = () => {
    setShouldShowCancelConfirmModal(true);
  };

  if (isSynchronizing) {
    return (
      <FullScreenLoadingIndicator
        loadingText={translate('tzFix.confirmation.syncing')}
      />
    );
  }

  return (
    <ScreenWrapper testID={ConfirmationScreen.displayName}>
      <HeaderWithBackButton
        onBackButtonPress={() => Navigation.navigate(ROUTES.TZ_FIX_DETECTION)}
        progressBarPercentage={66}
      />
      <View style={[styles.m5, styles.flexGrow1, styles.justifyContentBetween]}>
        <View>
          <Text style={[styles.textHeadline, styles.textAlignCenter]}>
            {translate('tzFix.confirmation.title')}
          </Text>
          <Text style={[styles.mt6, styles.textAlignCenter]}>
            {translate('tzFix.confirmation.text')}
          </Text>
          <Text style={[styles.mt2, styles.textLarge, styles.textAlignCenter]}>
            {selectedTimezone}
          </Text>
        </View>
        <View>
          <Button
            success
            style={[styles.mt4]}
            onPress={onCorrect}
            pressOnEnter
            large
            text={translate('tzFix.confirmation.syncNow')}
          />
          <Button
            danger
            style={[styles.mt2, styles.mb1]}
            onPress={onIncorrect}
            large
            text={translate('tzFix.confirmation.syncLater')}
          />
        </View>
        <ConfirmModal
          danger
          title={translate('common.areYouSure')}
          prompt={translate('tzFix.confirmation.cancelPrompt')}
          confirmText={translate('tzFix.confirmation.cancel')}
          cancelText={translate('tzFix.confirmation.resume')}
          isVisible={shouldShowCancelConfirmModal}
          onConfirm={() => Navigation.navigate(ROUTES.HOME)}
          onCancel={() => toggleCancelConfirmModal(false)}
        />
      </View>
    </ScreenWrapper>
  );
}

ConfirmationScreen.displayName = 'ConfirmationScreen';

export default ConfirmationScreen;
