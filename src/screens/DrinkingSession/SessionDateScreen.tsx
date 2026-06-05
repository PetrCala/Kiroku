import {endOfDay} from 'date-fns';
import {toZonedTime} from 'date-fns-tz';
import React, {useMemo, useState} from 'react';
import {Alert, View} from 'react-native';
import Button from '@components/Button';
import Calendar from '@components/DateSelectorModal/Calendar';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import ONYXKEYS from '@src/ONYXKEYS';
import type {StackScreenProps} from '@react-navigation/stack';
import type {DrinkingSessionNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import {useFirebase} from '@context/global/FirebaseContext';
import * as DS from '@userActions/DrinkingSession';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import useCurrentUserData from '@hooks/useCurrentUserData';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import {useOnyx} from 'react-native-onyx';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';

type SessionDateScreenProps = StackScreenProps<
  DrinkingSessionNavigatorParamList,
  typeof SCREENS.DRINKING_SESSION.SESSION_DATE_SCREEN
>;

function SesssionDateScreen({route}: SessionDateScreenProps) {
  const {sessionId, backTo} = route.params;
  const {auth} = useFirebase();
  const user = auth.currentUser;
  const [isBeingCreated] = useOnyx(ONYXKEYS.IS_CREATING_NEW_SESSION);
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const session = DSUtils.getDrinkingSessionData(sessionId);
  const userData = useCurrentUserData();
  // Resolve the day in the session's own timezone (falling back to the user's
  // selected tz) so the picker shows — and saves — the correct calendar day
  // even when the device tz differs from the session/selected tz.
  const sessionTimezone =
    session?.timezone ??
    userData?.timezone?.selected ??
    CONST.DEFAULT_TIME_ZONE.selected;
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    toZonedTime(session?.start_time ?? new Date(), sessionTimezone),
  );
  // `toZonedTime` is an Intl-backed (Hermes-slow) call; cache the picker cap so
  // it is computed once per tz change rather than on every render.
  const maxDate = useMemo(
    () => endOfDay(toZonedTime(new Date(), sessionTimezone)),
    [sessionTimezone],
  );

  const confirmTextKey: TranslationPaths = isBeingCreated
    ? 'common.confirm'
    : 'common.save';

  const onGoBack = () => {
    (async () => {
      if (isBeingCreated) {
        await DS.setIsCreatingNewSession(false);
      }
      if (backTo) {
        if (backTo === ROUTES.HOME) {
          // Cancelling the create flow: dismiss the whole modal in one slide
          // rather than navigating to a bottom-tab route, which forward-pushes
          // and bounces.
          Navigation.dismissModal();
        } else {
          Navigation.goBack(backTo as Route);
        }
        return;
      }
      Navigation.goBack();
    })();
  };

  const onConfirm = () => {
    (async () => {
      if (!user || !session) {
        Alert.alert(translate('sessionDateScreen.error.load'));
        return;
      }
      await DS.updateSessionDate(sessionId, session, selectedDate);
      if (isBeingCreated) {
        await DS.setIsCreatingNewSession(false);
        DS.navigateToEditSessionScreen(sessionId, undefined, ROUTES.HOME);
      } else {
        onGoBack();
      }
    })();
  };

  return (
    <ScreenWrapper
      includeSafeAreaPaddingBottom={false}
      testID={SesssionDateScreen.displayName}>
      <HeaderWithBackButton
        title={translate('sessionDateScreen.title')}
        onBackButtonPress={onGoBack}
      />
      <View style={[styles.flex1, styles.ph5]}>
        <Text style={[styles.mb3]}>
          {translate('sessionDateScreen.prompt')}
        </Text>
        <Calendar
          mode="single"
          initialDate={selectedDate}
          maxDate={maxDate}
          onChangeSingle={setSelectedDate}
        />
      </View>
      <View style={[styles.bottomTabBarContainer, styles.ph5]}>
        <Button
          large
          success
          text={translate(confirmTextKey)}
          onPress={onConfirm}
          style={styles.bottomTabButton}
        />
      </View>
    </ScreenWrapper>
  );
}

SesssionDateScreen.displayName = 'SesssionDateScreen';
export default SesssionDateScreen;
