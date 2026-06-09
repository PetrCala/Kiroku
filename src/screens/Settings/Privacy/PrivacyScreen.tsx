import React, {useEffect, useState} from 'react';
import {Alert, BackHandler, View} from 'react-native';
import {useFirebase} from '@context/global/FirebaseContext';
import useCurrentUserDataVisibility from '@hooks/useCurrentUserDataVisibility';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
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
import MenuItem from '@components/MenuItem';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import * as Preferences from '@userActions/Preferences';
import * as Privacy from '@userActions/Privacy';
import * as SessionLocations from '@userActions/SessionLocations';
import checkPermission from '@libs/Permissions/checkPermission';
import requestPermission from '@libs/Permissions/requestPermission';

function PrivacyScreen() {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const dataVisibility = useCurrentUserDataVisibility();
  const preferences = useCurrentUserPreferences();
  const {auth} = useFirebase();
  const user = auth.currentUser;

  // Absent ⇒ enabled (legitimate-interest opt-out default).
  const persistedCrashReporting =
    preferences?.crash_reporting_enabled !== false;
  const [pendingCrashReporting, setPendingCrashReporting] = useState<
    boolean | null
  >(null);
  const [savingCrashReporting, setSavingCrashReporting] = useState(false);
  const displayCrashReporting =
    pendingCrashReporting ?? persistedCrashReporting;

  const persistedTrackLocation =
    preferences?.track_location_during_sessions === true;
  const [pendingTrackLocation, setPendingTrackLocation] = useState<
    boolean | null
  >(null);
  const [savingTrackLocation, setSavingTrackLocation] = useState(false);
  const displayTrackLocation = pendingTrackLocation ?? persistedTrackLocation;

  const persistedHideFromAll = dataVisibility?.hide_from_all === true;
  const [pendingHideFromAll, setPendingHideFromAll] = useState<boolean | null>(
    null,
  );
  const displayHideFromAll = pendingHideFromAll ?? persistedHideFromAll;

  const [showPurgeConfirmModal, setShowPurgeConfirmModal] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const onToggleHideFromAll = (next: boolean) => {
    if (next === displayHideFromAll || !user) {
      return;
    }
    // Fire-and-forget: the write is queued and replayed offline. Reflect the new
    // value optimistically — there is no Onyx state to roll back (visibility
    // re-hydrates from Onyx, server-echoed by the privacy write) and the queued
    // write never throws.
    setPendingHideFromAll(next);
    Privacy.setHideFromAllFriends(next);
  };

  const onToggleCrashReporting = (next: boolean) => {
    if (savingCrashReporting || next === displayCrashReporting) {
      return;
    }
    setPendingCrashReporting(next);
    setSavingCrashReporting(true);
    Preferences.updatePreferences({
      crash_reporting_enabled: next,
    })
      .catch(error => {
        setPendingCrashReporting(null);
        const errorMessage = error instanceof Error ? error.message : '';
        Alert.alert(translate('privacyScreen.error.save'), errorMessage);
      })
      .finally(() => setSavingCrashReporting(false));
  };

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
        return Preferences.updatePreferences({
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
    // Fire-and-forget: the write is queued and replayed offline, so reflect it
    // optimistically. There is no Onyx state to roll back and the queued write
    // never throws here.
    SessionLocations.purgeAll();
    setShowPurgeConfirmModal(false);
    Alert.alert(translate('privacyScreen.clearLocationHistory.success'));
    setIsPurging(false);
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
          title={translate('privacyScreen.friendsVisibilitySection.title')}
          titleStyles={styles.generalSectionTitle}
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
                  {translate('privacyScreen.hideFromAllFriends.label')}
                </Text>
                <Text style={[styles.textMicroSupporting, styles.mt1]}>
                  {translate('privacyScreen.hideFromAllFriends.description')}
                </Text>
              </View>
              <Switch
                accessibilityLabel={translate(
                  'privacyScreen.hideFromAllFriends.label',
                )}
                isOn={displayHideFromAll}
                onToggle={onToggleHideFromAll}
              />
            </View>
          </View>
        </Section>
        <Section
          title={translate('privacyScreen.diagnosticsSection.title')}
          titleStyles={styles.generalSectionTitle}
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
                  {translate('privacyScreen.crashReporting.label')}
                </Text>
                <Text style={[styles.textMicroSupporting, styles.mt1]}>
                  {translate('privacyScreen.crashReporting.description')}
                </Text>
              </View>
              <Switch
                accessibilityLabel={translate(
                  'privacyScreen.crashReporting.label',
                )}
                isOn={displayCrashReporting}
                onToggle={onToggleCrashReporting}
              />
            </View>
          </View>
        </Section>
        <Section
          title={translate('privacyScreen.locationSection.title')}
          titleStyles={styles.generalSectionTitle}
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
        <Section
          title={translate('privacyScreen.accountSection.title')}
          titleStyles={styles.generalSectionTitle}
          isCentralPane
          childrenStyles={styles.pt3}>
          <MenuItem
            title={translate('privacyScreen.manageAccount.label')}
            description={translate('privacyScreen.manageAccount.description')}
            icon={KirokuIcons.Profile}
            iconType={CONST.ICON_TYPE_ICON}
            wrapperStyle={styles.sectionMenuItemTopDescription}
            shouldShowRightIcon
            onPress={() => Navigation.navigate(ROUTES.SETTINGS_MANAGE_ACCOUNT)}
          />
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
