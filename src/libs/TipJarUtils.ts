import type {PurchasesStoreProduct} from 'react-native-purchases';
import type {TupleToUnion} from 'type-fest';
import CONST from '@src/CONST';

/** One of the tip-jar consumable product ids, e.g. `kiroku.tip.pint`. */
type TipProductId = TupleToUnion<typeof CONST.TIPS.PRODUCT_IDS>;

/**
 * A tip as the Support screen shows it. The price comes straight from the
 * store (`priceString`), already formatted for the user's storefront and
 * currency; the app never formats one itself. The display *name* does not:
 * StoreKit localizes product names by the device's App Store storefront, not
 * by the app's language, so tier names are the app's own i18n strings instead.
 */
type TipProduct = {
  id: TipProductId;
  price: string;
};

function isTipProductId(id: string): id is TipProductId {
  return (CONST.TIPS.PRODUCT_IDS as readonly string[]).includes(id);
}

/**
 * Store products in tier order (cheapest first), dropping anything that is
 * not a tip. The store returns products in an unspecified order and silently
 * omits ids it does not recognize, so neither the order nor the count can be
 * assumed.
 */
function toTipProducts(
  products: readonly PurchasesStoreProduct[],
): TipProduct[] {
  const byId = new Map<string, PurchasesStoreProduct>();
  products.forEach(product => {
    if (!isTipProductId(product.identifier)) {
      return;
    }
    byId.set(product.identifier, product);
  });

  return CONST.TIPS.PRODUCT_IDS.flatMap(id => {
    const product = byId.get(id);
    return product ? [{id, price: product.priceString}] : [];
  });
}

export {isTipProductId, toTipProducts};
export type {TipProduct, TipProductId};
