import React, {useState} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import Button from '@components/Button';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import * as BACUtils from '@libs/BACUtils';
import Navigation from '@libs/Navigation/Navigation';
import * as UserData from '@userActions/UserData';
import ONYXKEYS from '@src/ONYXKEYS';
import BACQuestionnaire from './components/BACQuestionnaire';
import BACResult from './components/BACResult';

function AchievementsScreen() {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const [privateData] = useOnyx(ONYXKEYS.USER_PRIVATE_DATA);
  const [ongoingSession] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);
  const [isEditing, setIsEditing] = useState(false);

  const hasDetails = !!privateData?.weight && !!privateData?.gender;
  const isOngoing = ongoingSession?.ongoing === true;

  const onQuestionnaireSubmit = (gender: string, weightKg: number) => {
    UserData.updateBacProfile(gender, weightKg);
    setIsEditing(false);
  };

  const renderContent = () => {
    if (!hasDetails || isEditing) {
      return (
        <BACQuestionnaire
          initialGender={privateData?.gender}
          initialWeightKg={privateData?.weight}
          onSubmit={onQuestionnaireSubmit}
        />
      );
    }

    if (!isOngoing) {
      return (
        <View
          style={[
            styles.flex1,
            styles.alignItemsCenter,
            styles.justifyContentCenter,
            styles.ph5,
          ]}>
          <Text style={[styles.textAlignCenter, styles.mb6]}>
            {translate('achievementsScreen.bac.noSession')}
          </Text>
          <Button
            text={translate('achievementsScreen.bac.editDetails')}
            onPress={() => setIsEditing(true)}
          />
        </View>
      );
    }

    return (
      <View style={styles.flex1}>
        <BACResult
          bacPercent={BACUtils.estimateBacPercent(
            ongoingSession,
            privateData?.weight,
            privateData?.gender,
          )}
        />
        <View style={[styles.ph5, styles.pb5, styles.alignItemsCenter]}>
          <Button
            text={translate('achievementsScreen.bac.editDetails')}
            onPress={() => setIsEditing(true)}
          />
        </View>
      </View>
    );
  };

  return (
    <ScreenWrapper testID={AchievementsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('achievementsScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      {renderContent()}
    </ScreenWrapper>
  );
}

AchievementsScreen.displayName = 'Achievements Screen';
export default AchievementsScreen;
