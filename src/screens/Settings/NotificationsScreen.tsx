import React, {useState} from 'react';
import {Linking, View} from 'react-native';
import Button from '@components/Button';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Section from '@components/Section';
import Switch from '@components/Switch';
import Text from '@components/Text';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import useLocalize from '@hooks/useLocalize';
import usePushPermissionStatus from '@hooks/usePushPermissionStatus';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as PushNotificationActions from '@userActions/PushNotification';
import type {TranslationPaths} from '@src/languages/types';

type ToggleRowProps = {
  /** Label and description translation keys (`<prefix>.label`, `<prefix>.description`) */
  label: TranslationPaths;
  description: TranslationPaths;

  /** Whether the switch is on */
  isOn: boolean;

  /** Called with the requested value */
  onToggle: (isOn: boolean) => void;

  /** Greys the switch out */
  disabled?: boolean;
};

function ToggleRow({
  label,
  description,
  isOn,
  onToggle,
  disabled,
}: ToggleRowProps) {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  return (
    <View
      style={[
        styles.flexRow,
        styles.alignItemsCenter,
        styles.justifyContentBetween,
        styles.mb4,
      ]}>
      <View style={[styles.flexColumn, styles.flex1, styles.mr3]}>
        <Text style={[styles.textNormal, styles.textStrong]}>
          {translate(label)}
        </Text>
        <Text style={[styles.textMicroSupporting, styles.mt1]}>
          {translate(description)}
        </Text>
      </View>
      <Switch
        accessibilityLabel={translate(label)}
        isOn={isOn}
        onToggle={onToggle}
        disabled={disabled}
      />
    </View>
  );
}

/**
 * Notification settings. The switches are account-wide preferences that
 * kiroku-api reads before every push; the global one also drives the OS
 * permission on this device (turning it on asks for it when needed).
 */
function NotificationsScreen() {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const preferences = useCurrentUserPreferences();
  const {status: permissionStatus, refresh: refreshPermission} =
    usePushPermissionStatus();
  const [isEnabling, setIsEnabling] = useState(false);

  // Absent ⇒ on: the OS permission prompt is the opt-in, these are opt-outs.
  const isPushPreferenceOn = preferences?.push_notifications_enabled !== false;
  const isFriendRequestsOn =
    preferences?.push_friend_requests_enabled !== false;
  const isOffInSystem =
    permissionStatus === 'blocked' || permissionStatus === 'undetermined';
  const isPushOn = isPushPreferenceOn && !isOffInSystem;
  const isFriendRequestsSwitchOn = isPushOn && isFriendRequestsOn;

  const onTogglePush = (next: boolean) => {
    if (isEnabling || next === isPushOn) {
      return;
    }
    if (!next) {
      PushNotificationActions.setPushNotificationsEnabled(false);
      return;
    }
    setIsEnabling(true);
    PushNotificationActions.enablePushNotifications().finally(() => {
      setIsEnabling(false);
      refreshPermission();
    });
  };

  return (
    <ScreenWrapper testID={NotificationsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('notificationsScreen.title')}
        onBackButtonPress={() => Navigation.goBack()}
      />
      <ScrollView contentContainerStyle={[styles.w100]}>
        <Section
          title={translate('notificationsScreen.pushSection.title')}
          titleStyles={styles.generalSectionTitle}
          isCentralPane
          childrenStyles={styles.pt3}>
          <View style={styles.sectionMenuItemTopDescription}>
            <ToggleRow
              label="notificationsScreen.pushNotifications.label"
              description="notificationsScreen.pushNotifications.description"
              isOn={isPushOn}
              onToggle={onTogglePush}
              disabled={isEnabling}
            />
            <ToggleRow
              label="notificationsScreen.friendRequests.label"
              description="notificationsScreen.friendRequests.description"
              isOn={isFriendRequestsSwitchOn}
              onToggle={
                PushNotificationActions.setFriendRequestNotificationsEnabled
              }
              disabled={!isPushOn}
            />
            {permissionStatus === 'blocked' && isPushPreferenceOn ? (
              <View
                style={[styles.flexRow, styles.alignItemsCenter, styles.mb4]}>
                <Text
                  style={[
                    styles.textMicroSupporting,
                    styles.flex1,
                    styles.mr3,
                  ]}>
                  {translate('notificationsScreen.blockedBySystem')}
                </Text>
                <Button
                  small
                  text={translate('notificationsScreen.openSettings')}
                  onPress={() => {
                    Linking.openSettings();
                  }}
                />
              </View>
            ) : null}
            {permissionStatus === 'unavailable' ? (
              <Text style={[styles.textMicroSupporting, styles.mb4]}>
                {translate('notificationsScreen.mobileOnly')}
              </Text>
            ) : null}
          </View>
        </Section>
      </ScrollView>
    </ScreenWrapper>
  );
}

NotificationsScreen.displayName = 'Notifications Screen';

export default NotificationsScreen;
