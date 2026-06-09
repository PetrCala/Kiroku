import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

/**
 * Web sibling of the Subscriptions action module. RevenueCat
 * (react-native-purchases) is a native-only IAP SDK with no web build, so every
 * entry point here is a no-op that mirrors the native module's shape:
 *  - boot/login hooks (initialize/identify/forget) do nothing.
 *  - fetchCurrentOffering resolves to null, so the paywall renders its
 *    "unavailable" state and never shows a (non-functional) purchase button.
 *  - purchase/restore resolve to an error outcome.
 *
 * The `import type` above is erased at build time, so this file pulls no
 * react-native-purchases runtime code into the web bundle.
 */

/**
 * RevenueCat entitlement identifier — kept identical to the native module so
 * any shared consumer reads the same constant on every platform.
 */
const SUPPORTER_ENTITLEMENT_ID = 'supporter';

/** Mirrors the native PurchaseOutcome union. */
type PurchaseOutcome =
  | {status: 'success'; customerInfo: CustomerInfo}
  | {status: 'cancelled'}
  | {status: 'error'; message: string};

/** Mirrors the native RestoreOutcome union. */
type RestoreOutcome =
  | {status: 'success'; granted: boolean; customerInfo: CustomerInfo}
  | {status: 'error'; message: string};

const WEB_UNAVAILABLE_MESSAGE = 'In-app purchases are not available on web';

function initialize(): void {
  // No RevenueCat SDK on web — nothing to configure.
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function identify(_userId: string): void {
  // No RevenueCat SDK on web — nothing to reconcile.
}

function forget(): void {
  // No RevenueCat SDK on web — nothing to log out.
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function syncSupporterStatusFromCustomerInfo(_info: CustomerInfo): void {
  // The web build never receives CustomerInfo updates.
}

function fetchCurrentOffering(): Promise<PurchasesOffering | null> {
  return Promise.resolve(null);
}

function purchaseSupporterPackage(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _pkg: PurchasesPackage,
): Promise<PurchaseOutcome> {
  return Promise.resolve({status: 'error', message: WEB_UNAVAILABLE_MESSAGE});
}

function restoreSupporterPurchases(): Promise<RestoreOutcome> {
  return Promise.resolve({status: 'error', message: WEB_UNAVAILABLE_MESSAGE});
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
