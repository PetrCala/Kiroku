import React, {useState} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import Button from '@components/Button';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import * as BACUtils from '@libs/BACUtils';
import Navigation from '@libs/Navigation/Navigation';
import * as Preferences from '@userActions/Preferences';
import * as UserData from '@userActions/UserData';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {BacDisplayUnit} from '@src/types/onyx';
import BACIntroModal from './components/BACIntroModal';
import BACQuestionnaire from './components/BACQuestionnaire';
import BACResult from './components/BACResult';

function AchievementsScreen() {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const theme = useTheme();
  const {auth, db} = useFirebase();
  const user = auth.currentUser;
  const {preferences} = useDatabaseData();
  const [privateData] = useOnyx(ONYXKEYS.USER_PRIVATE_DATA);
  const [ongoingSession] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);
  const [isEditing, setIsEditing] = useState(false);
  const [manualIntro, setManualIntro] = useState(false);
  const [autoDismissed, setAutoDismissed] = useState(false);

  const hasDetails = !!privateData?.weight && !!privateData?.gender;
  const isOngoing = ongoingSession?.ongoing === true;
  const showQuestionnaire = !hasDetails || isEditing;

  const introSeen = preferences?.bac_intro_seen;
  const showIntro =
    manualIntro || (!!preferences && !introSeen && !autoDismissed);

  const displayUnit =
    preferences?.bac_display_unit ?? CONST.BAC.DISPLAY_UNIT.PER_MILLE;

  const dismissIntro = () => {
    if (!introSeen && user) {
      Preferences.updatePreferences(db, user, {bac_intro_seen: true}).catch(
        () => undefined,
      );
    }
    setAutoDismissed(true);
    setManualIntro(false);
  };

  const onChangeDisplayUnit = (unit: BacDisplayUnit) => {
    if (unit === displayUnit || !user) {
      return;
    }
    Preferences.updatePreferences(db, user, {bac_display_unit: unit}).catch(
      () => undefined,
    );
  };

  const onQuestionnaireSubmit = (gender: string, weightKg: number) => {
    UserData.updateBacProfile(gender, weightKg);
    setIsEditing(false);
  };

  const infoButton = (
    <PressableWithFeedback
      accessibilityLabel={translate('achievementsScreen.bac.intro.title')}
      onPress={() => setManualIntro(true)}
      style={{padding: 8}}>
      <Icon src={KirokuIcons.Info} fill={theme.icon} width={20} height={20} />
    </PressableWithFeedback>
  );

  return (
    <ScreenWrapper testID={AchievementsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('achievementsScreen.title')}
        onBackButtonPress={Navigation.goBack}
        customRightButton={infoButton}
      />

      {showQuestionnaire ? (
        <BACQuestionnaire
          initialGender={privateData?.gender}
          initialWeightKg={privateData?.weight}
          onSubmit={onQuestionnaireSubmit}
        />
      ) : (
        <>
          <View style={styles.flex1}>
            {isOngoing ? (
              <BACResult
                bacPercent={BACUtils.estimateBacPercent(
                  ongoingSession,
                  privateData?.weight,
                  privateData?.gender,
                )}
                displayUnit={displayUnit}
                onChangeDisplayUnit={onChangeDisplayUnit}
              />
            ) : (
              <View
                style={[
                  styles.flex1,
                  styles.alignItemsCenter,
                  styles.justifyContentCenter,
                  styles.ph5,
                ]}>
                <Text style={[styles.textAlignCenter]}>
                  {translate('achievementsScreen.bac.noSession')}
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.ph5, styles.pb5, styles.alignItemsCenter]}>
            <Button
              text={translate('achievementsScreen.bac.editDetails')}
              onPress={() => setIsEditing(true)}
            />
          </View>
        </>
      )}

      <BACIntroModal
        isVisible={showIntro}
        onGetStarted={dismissIntro}
        onClose={dismissIntro}
      />
    </ScreenWrapper>
  );
}

AchievementsScreen.displayName = 'Achievements Screen';
export default AchievementsScreen;
