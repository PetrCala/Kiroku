import {Platform} from 'react-native';
import Onyx from 'react-native-onyx';
import Purchases from 'react-native-purchases';
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
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

/**
 * Result of a paywall purchase attempt. `cancelled` is its own outcome —
 * the user pressing "no thanks" in the store sheet is not an error and the
 * UI should treat it as a silent dismissal.
 */
type PurchaseOutcome =
  | {status: 'success'; customerInfo: CustomerInfo}
  | {status: 'cancelled'}
  | {status: 'error'; message: string};

/**
 * Result of a "Restore Purchases" attempt. `granted` reflects whether the
 * supporter entitlement is now active after restore — the button shouldn't
 * silently succeed when there is nothing to restore.
 */
type RestoreOutcome =
  | {status: 'success'; granted: boolean; customerInfo: CustomerInfo}
  | {status: 'error'; message: string};

function hasSupporterEntitlement(info: CustomerInfo): boolean {
  return !!info.entitlements.active[SUPPORTER_ENTITLEMENT_ID];
}

/**
 * Fetches the RevenueCat "current" offering. Returns `null` if the SDK is
 * not configured (web, missing keys) or no offering is published — the
 * paywall should render its unavailable state in that case.
 */
async function fetchCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!isConfigured) {
    return null;
  }
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (error) {
    Log.warn('[Subscriptions] getOfferings failed', {error});
    return null;
  }
}

async function purchaseSupporterPackage(
  pkg: PurchasesPackage,
): Promise<PurchaseOutcome> {
  if (!isConfigured) {
    return {status: 'error', message: 'SDK not configured'};
  }
  try {
    const result = await Purchases.purchasePackage(pkg);
    return {status: 'success', customerInfo: result.customerInfo};
  } catch (error) {
    const rcError = error as {userCancelled?: boolean; message?: string};
    if (rcError?.userCancelled) {
      return {status: 'cancelled'};
    }
    Log.warn('[Subscriptions] purchasePackage failed', {error});
    return {
      status: 'error',
      message: rcError?.message ?? 'Unknown error',
    };
  }
}

async function restoreSupporterPurchases(): Promise<RestoreOutcome> {
  if (!isConfigured) {
    return {status: 'error', message: 'SDK not configured'};
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    return {
      status: 'success',
      granted: hasSupporterEntitlement(customerInfo),
      customerInfo,
    };
  } catch (error) {
    const rcError = error as {message?: string};
    Log.warn('[Subscriptions] restorePurchases failed', {error});
    return {
      status: 'error',
      message: rcError?.message ?? 'Unknown error',
    };
  }
}

export {
  fetchCurrentOffering,
  forget,
  identify,
  initialize,
  purchaseSupporterPackage,
  restoreSupporterPurchases,
  syncSupporterStatusFromCustomerInfo,
  SUPPORTER_ENTITLEMENT_ID,
};
export type {PurchaseOutcome, RestoreOutcome};
