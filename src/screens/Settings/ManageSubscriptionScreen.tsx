import React, {useCallback, useState} from 'react';
import {Linking, Platform, View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import Button from '@components/Button';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Section from '@components/Section';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {restoreSupporterPurchases} from '@libs/actions/Subscriptions';
import Navigation from '@libs/Navigation/Navigation';
import * as UserUtils from '@libs/UserUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {SupporterStatus} from '@src/types/onyx/UserData';

// Both stores require subscription cancellation in the OS settings, not in-app
// (Apple §3.1.2 / Play §4.5). The right CTA is a deep link to the platform's
// subscription manager — building a cancel flow in-app would fail review.
const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
const PLAY_PRODUCT_SKU = 'supporter_monthly';
const PLAY_PACKAGE_NAME = 'com.alcohol_tracker';
const PLAY_SUBSCRIPTIONS_URL = `https://play.google.com/store/account/subscriptions?sku=${PLAY_PRODUCT_SKU}&package=${PLAY_PACKAGE_NAME}`;

function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toLocaleDateString();
}

function ManageSubscriptionScreen() {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const [privateData] = useOnyx(ONYXKEYS.USER_PRIVATE_DATA);
  const supporter = UserUtils.getCurrentUserSupporterStatus(privateData);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  const status: SupporterStatus | null = supporter.supporter_status ?? null;
  const expiresDate = formatDate(supporter.supporter_expires_at);

  const handleManagePress = useCallback(() => {
    const url =
      Platform.OS === 'ios' ? APPLE_SUBSCRIPTIONS_URL : PLAY_SUBSCRIPTIONS_URL;
    Linking.openURL(url).catch(() => {
      // The store app is always installed on its own platform; if openURL
      // fails there is nothing useful to fall back to.
    });
  }, []);

  const handleRestore = useCallback(() => {
    (async () => {
      setIsRestoring(true);
      setRestoreMessage(null);
      const result = await restoreSupporterPurchases();
      setIsRestoring(false);
      if (result.status === 'success' && !result.granted) {
        setRestoreMessage(
          translate('supporter.manageSubscription.restoreEmpty'),
        );
      }
    })();
  }, [translate]);

  const renderStatusValue = () => {
    if (status === 'active') {
      return translate('supporter.manageSubscription.status.active');
    }
    if (status === 'cancelled') {
      return translate('supporter.manageSubscription.status.cancelled', {
        date: expiresDate,
      });
    }
    if (status === 'grace_period') {
      return translate('supporter.manageSubscription.status.gracePeriod');
    }
    if (status === 'expired') {
      return translate('supporter.manageSubscription.status.expired');
    }
    return null;
  };

  const renderDateLine = () => {
    if (!expiresDate) {
      return null;
    }
    const isExpired = status === 'expired';
    const key = isExpired
      ? 'supporter.manageSubscription.expiredOn'
      : 'supporter.manageSubscription.renewsOn';
    return (
      <Text style={[styles.textLabelSupporting, styles.mt1]}>
        {translate(key, {date: expiresDate})}
      </Text>
    );
  };

  const renderContextCopy = () => {
    if (status === 'grace_period') {
      return (
        <Text style={[styles.mt5, styles.textNormal]}>
          {translate('supporter.manageSubscription.billingIssueCopy')}
        </Text>
      );
    }
    if (status === 'expired') {
      return (
        <Text style={[styles.mt5, styles.textNormal]}>
          {translate('supporter.manageSubscription.expiredCopy')}
        </Text>
      );
    }
    return null;
  };

  const manageButtonLabel =
    Platform.OS === 'ios'
      ? translate('supporter.manageSubscription.manageInAppStore')
      : translate('supporter.manageSubscription.manageInGooglePlay');

  return (
    <ScreenWrapper testID={ManageSubscriptionScreen.displayName}>
      <HeaderWithBackButton
        title={translate('supporter.manageSubscription.title')}
        onBackButtonPress={() => Navigation.goBack(ROUTES.SETTINGS)}
      />
      <ScrollView contentContainerStyle={[styles.pt3, styles.ph5, styles.pb5]}>
        <Section
          title={translate('supporter.manageSubscription.statusHeader')}
          isCentralPane
          titleStyles={styles.accountSettingsSectionTitle}>
          <Text style={[styles.textLarge, styles.textStrong, styles.mt3]}>
            {renderStatusValue()}
          </Text>
          {renderDateLine()}
          {renderContextCopy()}
          <View style={[styles.mt5]}>
            <Button
              success
              large
              text={manageButtonLabel}
              onPress={handleManagePress}
            />
          </View>
          <View style={[styles.mt3]}>
            <Button
              link
              isLoading={isRestoring}
              isDisabled={isRestoring}
              text={translate('supporter.manageSubscription.restorePurchases')}
              onPress={handleRestore}
            />
          </View>
          {restoreMessage ? (
            <Text style={[styles.mt3, styles.textLabelSupporting]}>
              {restoreMessage}
            </Text>
          ) : null}
        </Section>
      </ScrollView>
    </ScreenWrapper>
  );
}

ManageSubscriptionScreen.displayName = 'ManageSubscriptionScreen';

export default ManageSubscriptionScreen;
