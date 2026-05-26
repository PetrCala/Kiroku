import React, {useEffect, useState} from 'react';
import {Alert, BackHandler, View} from 'react-native';
import {useFirebase} from '@context/global/FirebaseContext';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import Navigation from '@libs/Navigation/Navigation';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import ScrollView from '@components/ScrollView';
import Section from '@components/Section';
import Switch from '@components/Switch';
import Text from '@components/Text';
import Button from '@components/Button';
import ConfirmModal from '@components/ConfirmModal';
import * as Preferences from '@userActions/Preferences';
import * as SessionLocations from '@userActions/SessionLocations';
import checkPermission from '@libs/Permissions/checkPermission';
import requestPermission from '@libs/Permissions/requestPermission';

function PrivacyScreen() {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const {preferences} = useDatabaseData();
  const {auth, db} = useFirebase();
  const user = auth.currentUser;

  const persistedTrackLocation =
    preferences?.track_location_during_sessions === true;
  const [pendingTrackLocation, setPendingTrackLocation] = useState<
    boolean | null
  >(null);
  const [savingTrackLocation, setSavingTrackLocation] = useState(false);
  const displayTrackLocation = pendingTrackLocation ?? persistedTrackLocation;

  const [showPurgeConfirmModal, setShowPurgeConfirmModal] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const onToggleTrackLocation = (next: boolean) => {
    if (savingTrackLocation || next === displayTrackLocation) {
      return;
    }
    setPendingTrackLocation(next);
    setSavingTrackLocation(true);
    // requestPermission alerts the user itself on denial; rolling back the
    // toggle is enough — never persist "enabled" without the OS grant.
    const permissionCheck: Promise<boolean> = next
      ? checkPermission('location').then(allowed =>
          allowed ? Promise.resolve(true) : requestPermission('location'),
        )
      : Promise.resolve(true);
    permissionCheck
      .then(isGranted => {
        if (!isGranted) {
          setPendingTrackLocation(null);
          return undefined;
        }
        return Preferences.updatePreferences(db, user, {
          track_location_during_sessions: next,
        });
      })
      .catch(error => {
        setPendingTrackLocation(null);
        const errorMessage = error instanceof Error ? error.message : '';
        Alert.alert(translate('privacyScreen.error.save'), errorMessage);
      })
      .finally(() => setSavingTrackLocation(false));
  };

  const onConfirmPurge = () => {
    if (isPurging) {
      return;
    }
    setIsPurging(true);
    SessionLocations.purgeAll(db, user)
      .then(() => {
        setShowPurgeConfirmModal(false);
        Alert.alert(translate('privacyScreen.clearLocationHistory.success'));
      })
      .catch(error => {
        const errorMessage = error instanceof Error ? error.message : '';
        Alert.alert(
          translate('privacyScreen.clearLocationHistory.error'),
          errorMessage,
        );
      })
      .finally(() => setIsPurging(false));
  };

  // Match PreferencesScreen: the system back press goes back through the
  // app's navigation stack rather than the OS default.
  useEffect(() => {
    const backAction = () => {
      Navigation.goBack();
      return true;
    };
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <ScreenWrapper testID={PrivacyScreen.displayName}>
      <HeaderWithBackButton
        title={translate('privacyScreen.title')}
        onBackButtonPress={() => Navigation.goBack()}
      />
      <ScrollView contentContainerStyle={[styles.w100]}>
        <Section
          title={translate('privacyScreen.title')}
          titleStyles={styles.generalSectionTitle}
          subtitle={translate('privacyScreen.description')}
          subtitleMuted
          isCentralPane
          childrenStyles={styles.pt3}>
          <View style={styles.sectionMenuItemTopDescription}>
            <View
              style={[
                styles.flexRow,
                styles.alignItemsCenter,
                styles.justifyContentBetween,
                styles.mb4,
              ]}>
              <View style={[styles.flexColumn, styles.flex1, styles.mr3]}>
                <Text style={[styles.textNormal, styles.textStrong]}>
                  {translate('privacyScreen.trackLocationDuringSessions.label')}
                </Text>
                <Text style={[styles.textMicroSupporting, styles.mt1]}>
                  {translate(
                    'privacyScreen.trackLocationDuringSessions.description',
                  )}
                </Text>
              </View>
              <Switch
                accessibilityLabel={translate(
                  'privacyScreen.trackLocationDuringSessions.label',
                )}
                isOn={displayTrackLocation}
                onToggle={onToggleTrackLocation}
              />
            </View>
            <View
              style={[
                styles.flexRow,
                styles.alignItemsCenter,
                styles.justifyContentBetween,
                styles.mb4,
              ]}>
              <View style={[styles.flexColumn, styles.flex1, styles.mr3]}>
                <Text style={[styles.textNormal, styles.textStrong]}>
                  {translate('privacyScreen.clearLocationHistory.label')}
                </Text>
                <Text style={[styles.textMicroSupporting, styles.mt1]}>
                  {translate('privacyScreen.clearLocationHistory.description')}
                </Text>
              </View>
              <Button
                small
                danger
                text={translate('privacyScreen.clearLocationHistory.button')}
                isDisabled={isPurging}
                onPress={() => setShowPurgeConfirmModal(true)}
              />
            </View>
          </View>
        </Section>
        <ConfirmModal
          danger
          title={translate('privacyScreen.clearLocationHistory.confirmTitle')}
          prompt={translate('privacyScreen.clearLocationHistory.confirmPrompt')}
          confirmText={translate(
            'privacyScreen.clearLocationHistory.confirmAction',
          )}
          cancelText={translate('common.cancel')}
          isVisible={showPurgeConfirmModal}
          onConfirm={onConfirmPurge}
          onCancel={() => setShowPurgeConfirmModal(false)}
        />
      </ScrollView>
    </ScreenWrapper>
  );
}

PrivacyScreen.displayName = 'Privacy Screen';
export default PrivacyScreen;
