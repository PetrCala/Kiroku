import {useCallback, useEffect, useMemo, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import type {PurchasesStoreProduct} from 'react-native-purchases';
import {fetchTipProducts, purchaseTip} from '@libs/actions/Subscriptions';
import recordTipGiven from '@libs/actions/Tips';
import {toTipProducts} from '@libs/TipJarUtils';
import type {TipProduct, TipProductId} from '@libs/TipJarUtils';
import ONYXKEYS from '@src/ONYXKEYS';

/**
 * `loading` covers the store connection and the product fetch; `unavailable`
 * means the store answered with nothing usable (web, offline, or the products
 * not yet approved in App Store Connect), which is a normal state and not an
 * error to shout about.
 */
type TipJarStatus = 'loading' | 'ready' | 'unavailable';

type TipJar = {
  status: TipJarStatus;
  /** Tip products in tier order, with store-formatted prices. */
  products: TipProduct[];
  /** The product a purchase is in flight for, if any. */
  pendingId: TipProductId | null;
  /** Message of the last failed purchase; cleared on the next attempt.
   *  A cancelled purchase sheet is a silent dismissal, not an error. */
  purchaseError: string | null;
  /** Tips given on this device, ever. Drives the thank-you line only. */
  tipsGiven: number;
  tip: (id: TipProductId) => void;
  retry: () => void;
};

export default function useTipJar(): TipJar {
  // `null` means the fetch is still in flight.
  const [storeProducts, setStoreProducts] = useState<
    PurchasesStoreProduct[] | null
  >(null);
  const [pendingId, setPendingId] = useState<TipProductId | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [fetchAttempt, setFetchAttempt] = useState(0);
  const [tipsGiven] = useOnyx(ONYXKEYS.TIPS_GIVEN);

  // fetchTipProducts never rejects: failures come back as an empty list and
  // render as the unavailable state. `retry` resets storeProducts to null (the
  // loading state) before bumping the attempt, so this effect never sets state
  // synchronously.
  useEffect(() => {
    let isActive = true;
    fetchTipProducts().then(products => {
      if (!isActive) {
        return;
      }
      setStoreProducts(products);
    });
    return () => {
      isActive = false;
    };
  }, [fetchAttempt]);

  const products = useMemo(
    () => toTipProducts(storeProducts ?? []),
    [storeProducts],
  );

  const tip = useCallback(
    (id: TipProductId) => {
      if (pendingId) {
        return;
      }
      const product = storeProducts?.find(p => p.identifier === id);
      if (!product) {
        return;
      }
      setPendingId(id);
      setPurchaseError(null);
      // purchaseTip never rejects; cancellation is its own outcome and stays
      // silent.
      purchaseTip(product).then(outcome => {
        setPendingId(null);
        if (outcome.status === 'success') {
          recordTipGiven(tipsGiven ?? 0);
        } else if (outcome.status === 'error') {
          setPurchaseError(outcome.message);
        }
      });
    },
    [pendingId, storeProducts, tipsGiven],
  );

  const retry = useCallback(() => {
    setStoreProducts(null);
    setFetchAttempt(attempt => attempt + 1);
  }, []);

  let status: TipJarStatus = 'unavailable';
  if (storeProducts === null) {
    status = 'loading';
  } else if (products.length > 0) {
    status = 'ready';
  }

  return {
    status,
    products,
    pendingId,
    purchaseError,
    tipsGiven: tipsGiven ?? 0,
    tip,
    retry,
  };
}

export type {TipJar, TipJarStatus};
