import {Platform} from 'react-native';
import Onyx from 'react-native-onyx';
import Purchases from 'react-native-purchases';
import type {CustomerInfo} from 'react-native-purchases';
import CONFIG from '@src/CONFIG';
import ONYXKEYS from '@src/ONYXKEYS';
import Log from '@libs/Log';
import type {SupporterStatus, UserPrivateData} from '@src/types/onyx/UserData';

/**
 * RevenueCat entitlement identifier. Configured in the RevenueCat dashboard
 * (issue #364) and shared by iOS and Android.
 */
const SUPPORTER_ENTITLEMENT_ID = 'supporter';

let isConfigured = false;

function getPlatformApiKey(): string {
  if (Platform.OS === 'ios') {
    return CONFIG.REVENUECAT.IOS_API_KEY;
  }
  if (Platform.OS === 'android') {
    return CONFIG.REVENUECAT.ANDROID_API_KEY;
  }
  return '';
}

function deriveStatus(
  willRenew: boolean,
  hasBillingIssue: boolean,
  expiresAtMs: number | null,
): SupporterStatus {
  if (hasBillingIssue) {
    return 'grace_period';
  }
  if (expiresAtMs !== null && expiresAtMs < Date.now()) {
    return 'expired';
  }
  return willRenew ? 'active' : 'cancelled';
}

/**
 * Maps the RevenueCat `CustomerInfo` payload to the private supporter fields
 * stored on `USER_PRIVATE_DATA`. The public mirror on `USER_DATA` is written
 * server-side by the webhook handler (issue #368) and is intentionally not
 * touched here.
 */
function buildPrivateDataFromCustomerInfo(
  info: CustomerInfo,
): Partial<UserPrivateData> {
  const entitlement = info.entitlements.active[SUPPORTER_ENTITLEMENT_ID];
  if (!entitlement) {
    return {
      is_supporter: false,
      supporter_since: null,
      supporter_tier: null,
      supporter_expires_at: null,
      supporter_status: null,
    };
  }
  const expiresAtMs = entitlement.expirationDateMillis;
  return {
    is_supporter: true,
    supporter_since: entitlement.originalPurchaseDate,
    supporter_tier: entitlement.productIdentifier,
    supporter_expires_at: entitlement.expirationDate,
    supporter_status: deriveStatus(
      entitlement.willRenew,
      entitlement.billingIssueDetectedAt !== null,
      expiresAtMs,
    ),
  };
}

function syncSupporterStatusFromCustomerInfo(info: CustomerInfo) {
  Onyx.merge(
    ONYXKEYS.USER_PRIVATE_DATA,
    buildPrivateDataFromCustomerInfo(info),
  );
}

/**
 * Boot the RevenueCat SDK. No-op on web and when API keys are absent — the
 * latter is the intentional state shipped in the bootstrap PR, so the
 * internal-track AAB carries the BILLING permission without firing any
 * RevenueCat traffic. Once dashboard setup (#364) lands and keys are
 * populated, this will start configuring on each cold start.
 */
function initialize() {
  if (isConfigured) {
    return;
  }
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return;
  }
  const apiKey = getPlatformApiKey();
  if (!apiKey) {
    Log.info('[Subscriptions] RevenueCat API key missing — SDK disabled');
    return;
  }
  Purchases.configure({apiKey});
  Purchases.addCustomerInfoUpdateListener(syncSupporterStatusFromCustomerInfo);
  isConfigured = true;
}

function identify(userId: string) {
  if (!isConfigured) {
    return;
  }
  Purchases.logIn(userId).catch((error: unknown) => {
    Log.warn('[Subscriptions] logIn failed', {error});
  });
}

function forget() {
  if (!isConfigured) {
    return;
  }
  Purchases.logOut().catch((error: unknown) => {
    Log.warn('[Subscriptions] logOut failed', {error});
  });
}

export {
  initialize,
  identify,
  forget,
  syncSupporterStatusFromCustomerInfo,
  SUPPORTER_ENTITLEMENT_ID,
};
